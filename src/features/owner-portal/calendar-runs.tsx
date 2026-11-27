import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { formatStayDate } from '@/lib/stay-dates';
import type { CalendarRun } from './owner-portal-model';
import { StatusPill } from './portal-parts';
import { calendarTotals } from './owner-portal-model';

const KIND_STYLE: Record<CalendarRun['kind'], string> = {
  available: 'border-l-green-600',
  occupied: 'border-l-slate-500',
  blocked: 'border-l-amber-600',
  ownerStay: 'border-l-sky-600',
};

/** The kinds of the summary, in the order they are told. */
const SUMMARY_KINDS = ['available', 'occupied', 'blocked', 'ownerStay'] as const;

const DATE: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
const DATE_WITH_YEAR: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };

interface CalendarRunsProps {
  runs: readonly CalendarRun[];
  propertyName: string;
}

/**
 * The calendar of a property as the server draws it: runs of nights (arrival included, departure day excluded) of a neutral kind, as cards that stack on a phone and
 * sit two by two from a tablet up (there is no table to scroll sideways). A run says the dates, the nights and one word: free, occupied, closed, or a stay of the
 * owner with where it stands. It never says by whom, through which channel or why: the answer of the server has none of it, and the model keeps no more than the dates and the kind.
 */
export function CalendarRuns({ runs, propertyName }: CalendarRunsProps) {
  const { t, i18n } = useTranslation();
  const totals = calendarTotals(runs);

  return (
    <div className="space-y-4" data-testid="owner-calendar">
      <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4" aria-label={t('ownerPortal.calendar.summaryLabel')} data-testid="owner-calendar-summary">
        {SUMMARY_KINDS.map((kind) => (
          <div key={kind} className="rounded-md border bg-card p-3">
            <dt className="text-muted-foreground">{t(`ownerPortal.calendar.summary.${kind}`)}</dt>
            <dd className="text-lg font-semibold">{totals[kind]}</dd>
          </div>
        ))}
      </dl>

      {runs.length === 0 ? (
        <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground" data-testid="owner-calendar-empty">
          {t('ownerPortal.calendar.empty')}
        </p>
      ) : (
        <ul aria-label={t('ownerPortal.calendar.runsLabel', { property: propertyName })} className="grid gap-2 md:grid-cols-2" data-testid="owner-calendar-runs">
          {runs.map((run) => (
            <li
              key={run.key}
              data-kind={run.kind}
              className={cn('min-w-0 rounded-md border border-l-4 bg-card p-3', KIND_STYLE[run.kind])}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="min-w-0 break-words text-sm font-medium">
                  {t('ownerPortal.calendar.range', {
                    from: formatStayDate(run.start, i18n.language, DATE),
                    to: formatStayDate(run.end, i18n.language, DATE_WITH_YEAR),
                  })}
                </p>
                <StatusPill tone="neutral">{t(`ownerPortal.calendar.kinds.${run.kind}`)}</StatusPill>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {t('ownerPortal.calendar.nights', { count: run.nights })}
                {run.kind === 'ownerStay' && run.stayState ? ` · ${t(`ownerPortal.stays.state.${run.stayState}.title`)}` : ''}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
