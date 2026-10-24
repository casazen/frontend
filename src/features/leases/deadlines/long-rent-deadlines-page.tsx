import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CalendarCheck, Download } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { DayList, PlainSection } from '@/components/shared/calm';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { downloadCsv } from '@/components/shared/list-view/list-csv';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Segmented } from '@/components/ui/segmented';
import { SkeletonCard } from '@/components/ui/skeleton';
import { useWorkspace } from '@/hooks/use-workspace';
import { cn } from '@/lib/utils';
import { formatStayDate, todayInRome } from '@/lib/stay-dates';
import { useLongRentDeadlines } from '@/queries/use-long-rent-agenda';
import type { LongRentDeadline } from '@/types';
import {
  DEADLINE_FILTER_OPTIONS,
  FIRST_WINDOW_DAYS,
  agendaWindow,
  deadlineFilterOf,
  deadlineRow,
  deadlinesCsv,
  deadlinesCsvName,
  filterDeadlines,
  groupByMonth,
  longerWindowDays,
  type DeadlineContext,
  type DeadlineFilterId,
} from './deadlines-model';

const LEASE_CREATE_PATH = '/app/long-rent/leases/new';
/** The quick filter is in the address like the quick filters of the lists (`?chip=renewals`). */
const FILTER_PARAM = 'chip';

function DeadlineGroup({ title, count, items, context }: { title: string; count?: number; items: readonly LongRentDeadline[]; context: DeadlineContext }) {
  return (
    <PlainSection title={title} count={count}>
      <DayList items={items.map((item) => deadlineRow(item, context))} />
    </PlainSection>
  );
}

/**
 * Scadenze (LR-05): the dates the landlord must not miss, from the server's agenda, month by month. The ones past and still open come
 * first («Da fare subito»), then the months; the quick filters narrow them by kind, and the next ninety days can grow to a year.
 * Every row leads to the page that deals with the date (the lease, or the rent register); nothing here is ticked off by hand, a
 * date goes when the thing is done. The file holds the dates on the screen.
 */
export function LongRentDeadlinesPage() {
  const { t, i18n } = useTranslation();
  const { hasPermission } = useWorkspace();
  const [params, setParams] = useSearchParams();
  const filter = deadlineFilterOf(params.get(FILTER_PARAM));
  const [days, setDays] = useState<number>(FIRST_WINDOW_DAYS);

  const today = todayInRome();
  const context = useMemo<DeadlineContext>(() => ({ t, today }), [t, today]);
  const agenda = useLongRentDeadlines(agendaWindow(today, days));
  const data = agenda.data;
  const canCreate = hasPermission('long-rent', 'lease.create');

  const shown = useMemo(() => filterDeadlines(data?.items ?? [], filter), [data, filter]);
  const late = useMemo(() => shown.filter((item) => item.isOverdue), [shown]);
  const months = useMemo(() => groupByMonth(shown.filter((item) => !item.isOverdue), i18n.language), [shown, i18n.language]);
  const longer = longerWindowDays(days);

  const chooseFilter = (next: DeadlineFilterId) =>
    setParams(
      (previous) => {
        const copy = new URLSearchParams(previous);
        if (next === 'all') copy.delete(FILTER_PARAM);
        else copy.set(FILTER_PARAM, next);
        return copy;
      },
      { replace: true, preventScrollReset: true },
    );

  const exportCsv = () => {
    if (data && shown.length > 0) downloadCsv(deadlinesCsvName(data.from, data.to), deadlinesCsv(shown, context));
  };

  const showMore = longer ? (
    <Button type="button" variant="outline" onClick={() => setDays(longer)} data-testid="long-rent-deadlines-more">
      {t('longRentDeadlines.more')}
    </Button>
  ) : null;

  return (
    <div className="min-w-0 space-y-6" data-testid="long-rent-deadlines">
      <PageHeader
        title={t('longRentDeadlines.title')}
        description={t('longRentDeadlines.description')}
        crumbs="auto"
        primary={{
          label: t('longRentDeadlines.csv.button'),
          icon: Download,
          onClick: exportCsv,
          disabled: shown.length === 0,
          testId: 'long-rent-deadlines-csv',
        }}
        mobilePrimary="none"
      />

      {data ? (
        data.items.length === 0 ? (
          <div className="space-y-4" data-testid="long-rent-deadlines-empty">
            <EmptyState
              icon={CalendarCheck}
              title={t('longRentDeadlines.empty.title', { days })}
              description={t('longRentDeadlines.empty.description')}
              action={canCreate ? { label: t('longRentDeadlines.empty.action'), href: LEASE_CREATE_PATH } : undefined}
            />
            {showMore ? <div className="flex justify-center">{showMore}</div> : null}
          </div>
        ) : (
          <div className="space-y-8" aria-busy={agenda.isPlaceholderData}>
            <Segmented
              label={t('longRentDeadlines.filters.label')}
              options={DEADLINE_FILTER_OPTIONS.map((option) => ({ value: option.id, label: t(option.labelKey), testId: `long-rent-deadlines-filter-${option.id}` }))}
              value={filter}
              onValueChange={chooseFilter}
              testId="long-rent-deadlines-filters"
            />

            <div className={cn('space-y-8 transition-opacity', agenda.isPlaceholderData && 'opacity-60')}>
              {late.length > 0 ? (
                <DeadlineGroup title={t('longRentDeadlines.overdueTitle')} count={late.length} items={late} context={context} />
              ) : null}
              {months.map((group) => (
                <DeadlineGroup key={group.month} title={group.title} items={group.items} context={context} />
              ))}
              {shown.length === 0 ? <p className="text-sm text-foreground/70">{t('longRentDeadlines.noneOfType')}</p> : null}
            </div>

            {data.truncated && (filter === 'all' || filter === 'rents') ? (
              <Alert variant="info" data-testid="long-rent-deadlines-truncated">
                {t('longRentDeadlines.truncated')}
              </Alert>
            ) : null}

            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="min-w-0 text-sm text-foreground/70">
                {t('longRentDeadlines.until', { date: formatStayDate(data.to, i18n.language) })}
              </p>
              {showMore}
            </div>
          </div>
        )
      ) : agenda.isError ? (
        <ErrorState
          title={t('longRentDeadlines.loadError')}
          error={agenda.error}
          onRetry={() => void agenda.refetch()}
          testId="long-rent-deadlines-error"
        />
      ) : (
        <SkeletonCard lines={4} label={t('longRentDeadlines.loading')} />
      )}
    </div>
  );
}
