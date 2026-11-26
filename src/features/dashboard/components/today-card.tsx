import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CalendarDays, LogIn, LogOut, Sparkles, Sun, Wrench, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Segmented } from '@/components/ui/segmented';
import { AskArrivalsButton } from '@/features/assistant/ask/ask-trigger';
import { formatDateRange } from '@/components/shared/list-view/list-state';
import { BOOKINGS_PATH } from '@/features/bookings/lib/booking-list-query';
import { formatStayDate } from '@/lib/stay-dates';
import type { DashboardToday } from '@/types/dashboard.types';
import type { HomeRow, TodayKind } from '../lib/home-model';
import { HomeRowItem } from './home-row';

const KIND_ICONS: Record<TodayKind, LucideIcon> = { arrivals: LogIn, departures: LogOut, cleaning: Sparkles, jobs: Wrench };
const KINDS: readonly TodayKind[] = ['arrivals', 'departures', 'cleaning', 'jobs'];

interface TodayCardProps {
  rows: HomeRow[];
  today: DashboardToday;
  propertyId: string;
}

/** The dashboard lists only the first few records per group, before the local property filter. */
function omitted({ arrivals, departures, services }: DashboardToday, kind: TodayKind | 'all') {
  const lists = kind === 'all' ? [arrivals, departures, services] : [kind === 'arrivals' ? arrivals : kind === 'departures' ? departures : services];
  return lists.some(list => list.count > list.items.length);
}

export function TodayCard({ rows, today, propertyId }: TodayCardProps) {
  const { t, i18n } = useTranslation();
  const [params, setParams] = useSearchParams();
  const kind = KINDS.find(value => value === params.get('today')) ?? 'all';
  const shown = kind === 'all' ? rows : rows.filter(row => row.kind === kind);
  const partial = omitted(today, kind);

  const selectKind = (value: TodayKind | 'all') => {
    const next = new URLSearchParams(params);
    if (value === 'all') next.delete('today');
    else next.set('today', value);
    setParams(next);
  };

  const calendarParams = new URLSearchParams({ view: 'timeline', from: today.today });
  const bookingParams = new URLSearchParams({ chip: 'all', f_arrival: formatDateRange({ from: today.today, to: today.today }) });
  if (propertyId) {
    calendarParams.set('propertyId', propertyId);
    bookingParams.set('f_property', propertyId);
  }
  const calendarPath = `${BOOKINGS_PATH}/calendar?${calendarParams}`;
  const kinds: (TodayKind | 'all')[] = ['all', ...KINDS.filter(value => value === 'arrivals' || value === 'departures' || value === kind || rows.some(row => row.kind === value))];

  return (
    <section aria-labelledby="home-today-title" data-testid="home-today" className="min-w-0 rounded-xl border border-border bg-card">
      <header className="space-y-4 rounded-t-xl border-b border-border bg-primary/5 px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h2 id="home-today-title" className="flex items-center gap-2 text-xl font-bold tracking-tight"><CalendarDays aria-hidden="true" className="size-6 text-primary-text" />{t('dashboard.today.title')}</h2>
          <time dateTime={today.today} className="rounded-md border bg-card px-2 py-1 text-sm font-medium text-foreground">
            {formatStayDate(today.today, i18n.language, { weekday: 'long', day: 'numeric', month: 'long' })}
          </time>
        </div>
        <Segmented<TodayKind | 'all'>
          label={t('dashboard.today.filterLabel')}
          value={kind}
          onValueChange={selectKind}
          className="flex-wrap overflow-visible"
          options={kinds.map(value => {
            const label = t(`dashboard.today.kinds.${value}`);
            const count = value === 'all' ? rows.length : rows.filter(row => row.kind === value).length;
            return { value, label: omitted(today, value) ? label : `${label} ${count}` };
          })}
        />
      </header>

      {shown.length > 0 ? (
        <ul role="list" className="divide-y divide-border">
          {shown.map(row => <HomeRowItem key={row.id} row={row} icon={row.kind ? KIND_ICONS[row.kind] : undefined} className="px-4 sm:px-5" />)}
        </ul>
      ) : !partial ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-5 sm:px-5">
          <Sun aria-hidden="true" className="size-5 shrink-0 text-foreground/70" />
          <p role="status" className="min-w-0 text-sm font-medium">{t(kind === 'all' ? 'dashboard.today.free.text' : `dashboard.today.empty.${kind}`)}</p>
        </div>
      ) : null}

      {partial ? (
        <p role="status" className="border-t border-border px-4 py-3 text-sm text-foreground/75 sm:px-5">
          {t('dashboard.today.partial')}{' '}
          {kind === 'arrivals' && (
            <Link to={`${BOOKINGS_PATH}?${bookingParams}`} className="font-medium text-primary-text underline">
              {t('dashboard.today.moreLink')}
            </Link>
          )}
        </p>
      ) : null}

      <footer className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-border px-4 py-1.5 sm:px-5">
        <Button asChild variant="link" size="sm" className="h-auto min-h-11 whitespace-normal px-0 text-primary-text">
          <Link to={calendarPath}><CalendarDays aria-hidden="true" className="size-4" />{t('dashboard.today.free.cta')}</Link>
        </Button>
        <AskArrivalsButton />
      </footer>
    </section>
  );
}
