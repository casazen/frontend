import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Sun } from 'lucide-react';
import { DayList, FocusBlock, type DayListItem } from '@/components/shared/calm';
import { useDetailDrawer } from '@/components/shared/detail-drawer/use-detail-drawer';
import { ErrorState } from '@/components/shared/error-state';
import { Button } from '@/components/ui/button';
import { Segmented } from '@/components/ui/segmented';
import { SkeletonCard } from '@/components/ui/skeleton';
import { formatRomeDateTime, romeDateOf, romeWallClock } from '@/lib/stay-dates';
import { useSupplierChecklist, useSupplierToday } from '@/queries/use-supplier';
import type { SupplierServiceRequest } from '@/types/service-request';
import { INBOX_PATH, phaseOf, REQUEST_DRAWER_KIND, requestTitle, requestWhen, respondByText } from '../requests/request-model';
import '../requests/supplier-request-drawer';
import type { RequestActions } from '../requests/use-request-actions';
import { formatMoney } from '../services/lib/service-money';
import { NEW_SERVICE_PATH } from '../services/lib/service-paths';
import { AVAILABILITY_PATH, HOME_DAYS, hasNotBegun, todayRows } from './home-model';

const TIME: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' };
/** The day of a job that has none yet ("da concordare") has nothing to write in the first column. */
const NO_DAY = '—';

/** `?oggi=` of the address: which kind of row the block shows. Nothing is every kind. */
const FILTER_PARAM = 'oggi';
type Kind = 'requests' | 'jobs';
const KIND_PARAMS: Record<Kind, string> = { requests: 'richieste', jobs: 'lavori' };

type Translate = (key: string, options?: Record<string, unknown>) => string;

/** The first column of a row: the time of the job when it is today, otherwise the day (the list writes it "18 ott"). */
function whenOf(request: SupplierServiceRequest, today: string, locale: string): Pick<DayListItem, 'day' | 'date' | 'dateTime'> {
  const day = request.scheduledFor || romeDateOf(request.scheduledStart);
  if (!day) return { date: NO_DAY };
  const start = request.scheduledStart;
  const clock = start ? romeWallClock(start) : null;
  if (day !== today || !start || !clock) return { day };
  // The words follow the language of the app ("10:00", "10:00 AM"); the machine value of the `<time>` is always 24 hours.
  const hhmm = `${String(clock.hour).padStart(2, '0')}:${String(clock.minute).padStart(2, '0')}`;
  return { day, date: formatRomeDateTime(start, locale, TIME), dateTime: `${clock.date}T${hhmm}` };
}

/** A link of the foot of the block: quiet, as high as a finger. */
function MoreLink({ to, children }: { to: string; children: string }) {
  return (
    <Link
      to={to}
      className="inline-flex min-h-11 items-center gap-1 rounded-md px-1 text-sm font-medium text-primary-text outline-hidden ring-offset-background hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      {children}
      <ArrowRight aria-hidden="true" className="size-4 shrink-0" />
    </Link>
  );
}

/**
 * "Oggi e prossimi giorni", the one highlighted block of the home: the requests that wait for the answer (each with its "Accetta"), then
 * the jobs of the next days. A row opens the request in the drawer of the shell; "Accetta" is the same action as in the list of the
 * requests, and the server may refuse it (409) when the supplier already has a job in that time: the toast says why. The chips show one
 * kind of row without leaving the page.
 */
export function TodaySection({ actions }: { actions: RequestActions }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const drawer = useDetailDrawer();
  const [params, setParams] = useSearchParams();
  const query = useSupplierToday(HOME_DAYS);
  const checklist = useSupplierChecklist();

  if (query.isLoading) return <SkeletonCard lines={5} />;
  if (query.isError || !query.data) {
    return <ErrorState title={t('supplier.home.today.loadError')} error={query.error} onRetry={() => void query.refetch()} testId="supplier-today-error" />;
  }

  const today = query.data;
  const { requests, jobs, moreRequests } = todayRows(today);
  const open = (id: string) => drawer.open(REQUEST_DRAWER_KIND, id);

  if (requests.length === 0 && jobs.length === 0) {
    // Nothing to do. For a supplier who has not begun (no service, no working hours) that is the moment to say where to begin.
    if (checklist.isLoading) return <SkeletonCard lines={2} />;
    if (hasNotBegun(checklist.data)) {
      return (
        <FocusBlock
          data-testid="supplier-today"
          kicker={t('supplier.home.first.kicker')}
          title={t('supplier.home.first.title')}
          body={t('supplier.home.first.body')}
          primary={{ label: t('supplier.home.first.availability'), href: AVAILABILITY_PATH }}
          secondary={{ label: t('supplier.home.first.service'), href: NEW_SERVICE_PATH }}
        />
      );
    }
  }

  const rows = [
    ...requests.map((request) => ({ kind: 'requests' as const, item: requestRow(request, { t, locale, today: today.date, actions, open }) })),
    ...jobs.map((job) => ({ kind: 'jobs' as const, item: jobRow(job, { t, locale, today: today.date, open }) })),
  ];
  const counts: Record<Kind, number> = { requests: requests.length, jobs: jobs.length };
  const asked = (Object.keys(KIND_PARAMS) as Kind[]).find((kind) => KIND_PARAMS[kind] === params.get(FILTER_PARAM));
  const current = asked && counts[asked] > 0 ? asked : null;
  const shown = current ? rows.filter((row) => row.kind === current) : rows;
  const choose = (kind: Kind | 'all') =>
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        if (kind === 'all') next.delete(FILTER_PARAM);
        else next.set(FILTER_PARAM, KIND_PARAMS[kind]);
        return next;
      },
      { replace: true },
    );

  return (
    <section
      aria-labelledby="supplier-today-title"
      data-testid="supplier-today"
      className="min-w-0 overflow-hidden rounded-xl bg-card ring-1 ring-inset ring-primary/25"
    >
      <header className="space-y-3 bg-primary-soft px-4 py-4 sm:px-5">
        <h2 id="supplier-today-title" className="break-words text-xl font-bold tracking-tight">
          {t('supplier.home.today.title')}
        </h2>
        {requests.length > 0 && jobs.length > 0 ? (
          <Segmented<Kind | 'all'>
            label={t('supplier.home.today.filterLabel')}
            value={current ?? 'all'}
            onValueChange={choose}
            options={[
              { value: 'all', label: `${t('supplier.home.today.kinds.all')} ${rows.length}` },
              { value: 'requests', label: `${t('supplier.home.today.kinds.requests')} ${counts.requests}` },
              { value: 'jobs', label: `${t('supplier.home.today.kinds.jobs')} ${counts.jobs}` },
            ]}
          />
        ) : null}
      </header>

      {rows.length > 0 ? (
        <>
          <div className="px-4 sm:px-5">
            <DayList items={shown.map((row) => row.item)} className="border-y-0" />
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-1 border-t border-border px-4 py-1 sm:px-5">
            {moreRequests > 0 ? <MoreLink to={`${INBOX_PATH}?chip=da-rispondere`}>{t('supplier.home.today.moreRequests', { count: moreRequests })}</MoreLink> : null}
            <MoreLink to={AVAILABILITY_PATH}>{t('supplier.home.today.openAvailability')}</MoreLink>
          </div>
        </>
      ) : (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3 p-4 sm:p-5" data-testid="supplier-today-free">
          <span aria-hidden="true" className="grid size-11 shrink-0 place-items-center rounded-full bg-muted text-foreground/70">
            <Sun className="size-[22px]" />
          </span>
          <div className="min-w-0 flex-1 basis-52">
            <p className="font-semibold">{t('supplier.home.free.title')}</p>
            <p className="text-sm text-foreground/70">{t('supplier.home.free.body')}</p>
          </div>
          <Button asChild variant="outline" size="sm" className="h-auto min-h-11 whitespace-normal py-2">
            <Link to={AVAILABILITY_PATH}>{t('supplier.home.today.openAvailability')}</Link>
          </Button>
        </div>
      )}
    </section>
  );
}

interface RowContext {
  t: Translate;
  locale: string;
  /** Today in Europe/Rome, as the server says it. */
  today: string;
  open: (id: string) => boolean;
}

/** A new request: who asks and where, until when to answer, and the button that takes it. */
function requestRow(request: SupplierServiceRequest, { t, locale, today, actions, open }: RowContext & { actions: RequestActions }): DayListItem {
  const name = requestTitle(request, t);
  const price = request.price?.amountCents;
  const respond = respondByText(request, locale, t);
  return {
    id: request.id,
    ...whenOf(request, today, locale),
    title: name,
    subtitle: [requestWhen(request, locale).time, request.clientName, request.city, price === null || price === undefined ? null : formatMoney(price, locale)]
      .filter(Boolean)
      .join(' · '),
    meta: respond ?? undefined,
    tone: respond ? 'warning' : undefined,
    onOpen: () => void open(request.id),
    action: {
      label: t('supplier.requests.action.take'),
      ariaLabel: t('supplier.home.today.takeAria', { name }),
      onClick: () => actions.take(request.id),
      loading: actions.takingId === request.id,
      disabled: actions.suspended || (actions.busy && actions.takingId !== request.id),
      testId: `take-${request.id}`,
    },
  };
}

/** A job of the next days: the property and what is to be done, and where it is (its hours, "in corso", "finito"). */
function jobRow(job: SupplierServiceRequest, { t, locale, today, open }: RowContext): DayListItem {
  const name = requestTitle(job, t);
  const phase = phaseOf(job);
  const note: Pick<DayListItem, 'meta' | 'tone'> =
    phase === 'inProgress'
      ? {
          meta: job.startedAt ? t('supplier.home.today.inProgressSince', { time: formatRomeDateTime(job.startedAt, locale, TIME) }) : t('supplier.home.today.inProgress'),
          tone: 'info',
        }
      : phase === 'completed'
        ? job.payment?.late
          ? { meta: t('supplier.home.today.paymentLate'), tone: 'warning' }
          : { meta: t('supplier.home.today.completed'), tone: 'success' }
        : { meta: requestWhen(job, locale).time ?? undefined };
  return {
    id: job.id,
    ...whenOf(job, today, locale),
    title: job.propertyName || name,
    subtitle: [job.propertyName ? name : job.clientName, job.city].filter(Boolean).join(' · '),
    ...note,
    onOpen: () => void open(job.id),
  };
}
