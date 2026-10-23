import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Ban } from 'lucide-react';
import { addDays, formatStayDate } from '@/lib/stay-dates';
import { cn } from '@/lib/utils';
import { agendaHref } from '../lib/agenda-range';
import { DAY_STATE_LABEL_KEYS, WEEKDAYS, dayStateOf, weekdayOf, type WorkingDayView } from '../lib/supplier-agenda';

// Any Monday: the short names of the week, in the language of the app, come from its seven days.
const A_MONDAY = '2026-10-12';
const COUNT_PILL = 'rounded-full bg-primary-soft px-1.5 text-xs font-semibold text-primary-text';

interface MonthCellProps {
  day: WorkingDayView;
  today: string;
  pending: boolean;
}

/** A day of the month: its number, how many things are in it and, by icon, whether it is closed or waits for an answer. It opens the day. */
function MonthCell({ day, today, pending }: MonthCellProps) {
  const { t, i18n } = useTranslation();
  const state = dayStateOf(day);
  const count = day.events.filter((event) => event.kind !== 'timeOff').length;
  const unavailable = state === 'closed' || state === 'closedByCalendar' || state === 'timeOff';
  const isToday = day.date === today;
  const summary = [
    t(DAY_STATE_LABEL_KEYS[state]),
    count > 0 ? t('supplier.agenda.eventsCount', { count }) : null,
    pending ? t('supplier.freeEventPendingBadge') : null,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <Link
      to={agendaHref('day', day.date, today)}
      aria-label={`${formatStayDate(day.date, i18n.language, { weekday: 'long', day: 'numeric', month: 'long' })}: ${summary}`}
      aria-current={isToday ? 'date' : undefined}
      data-testid={`availability-${day.date}`}
      className={cn(
        'flex min-h-14 min-w-0 flex-col items-center justify-between gap-0.5 rounded-lg p-1 text-sm ring-1 ring-inset ring-border hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        state === 'open' ? 'bg-card' : 'bg-muted text-foreground/70',
      )}
    >
      <span className={cn('grid size-7 place-items-center rounded-full font-semibold tabular-nums', isToday && 'bg-primary text-primary-foreground')}>
        {Number(day.date.slice(8))}
      </span>
      <span aria-hidden="true" className="flex min-h-4 flex-wrap items-center justify-center gap-1">
        {count > 0 ? <span className={COUNT_PILL}>{count}</span> : null}
        {unavailable ? <Ban className="size-3.5" /> : null}
        {pending ? <AlertTriangle className="size-3.5 text-warning-foreground" /> : null}
      </span>
    </Link>
  );
}

interface AgendaMonthViewProps {
  /** Every day of the month, in order. */
  days: readonly WorkingDayView[];
  today: string;
  /** The days a "Disponibile" event of the calendar holds until it is answered. */
  pendingDates: ReadonlySet<string>;
}

/** The month as a grid of weeks, Monday first: one cell a day, no detail. A cell opens the day. */
export function AgendaMonthView({ days, today, pendingDates }: AgendaMonthViewProps) {
  const { t, i18n } = useTranslation();
  if (days.length === 0) return null;
  const blanks = WEEKDAYS.indexOf(weekdayOf(days[0].date));

  return (
    <div className="space-y-3" data-testid="agenda-month">
      <div className="grid grid-cols-7 gap-0.5 sm:gap-1.5">
        {Array.from({ length: 7 }, (_, index) => (
          <span key={index} aria-hidden="true" className="truncate py-1 text-center text-xs font-semibold uppercase text-foreground/70">
            {formatStayDate(addDays(A_MONDAY, index), i18n.language, { weekday: 'short' })}
          </span>
        ))}
        {Array.from({ length: blanks }, (_, index) => (
          <span key={`blank-${index}`} aria-hidden="true" />
        ))}
        {days.map((day) => (
          <MonthCell key={day.date} day={day} today={today} pending={pendingDates.has(day.date)} />
        ))}
      </div>
      <ul role="list" aria-label={t('supplier.agenda.legend.label')} className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-foreground/80">
        <li className="inline-flex items-center gap-2">
          <span aria-hidden="true" className={COUNT_PILL}>
            3
          </span>
          {t('supplier.agenda.legend.events')}
        </li>
        <li className="inline-flex items-center gap-2">
          <Ban aria-hidden="true" className="size-3.5" />
          {t('supplier.agenda.legend.unavailable')}
        </li>
        <li className="inline-flex items-center gap-2">
          <AlertTriangle aria-hidden="true" className="size-3.5 text-warning-foreground" />
          {t('supplier.freeEventPendingBadge')}
        </li>
      </ul>
    </div>
  );
}
