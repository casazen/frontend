import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { formatStayDate } from '@/lib/stay-dates';
import { agendaHref } from '../lib/agenda-range';
import { dayStateOf, formatBands, type WorkingDayView } from '../lib/supplier-agenda';
import { AgendaEventItem, DayStateLabel, PendingDayBadge } from './agenda-event-item';

interface AgendaWeekViewProps {
  days: readonly WorkingDayView[];
  today: string;
  /** The days a "Disponibile" event of the calendar holds until it is answered. */
  pendingDates: ReadonlySet<string>;
}

/**
 * The seven days of a week. On a phone and on a tablet they are a list, one under the other (seven columns would be
 * unreadable); from a wide screen they stand side by side. The name of a day opens that day.
 */
export function AgendaWeekView({ days, today, pendingDates }: AgendaWeekViewProps) {
  const { t, i18n } = useTranslation();

  return (
    <ul role="list" className="grid items-start gap-3 md:grid-cols-2 xl:grid-cols-7" data-testid="agenda-week">
      {days.map((day) => {
        const state = dayStateOf(day);
        return (
          <li key={day.date} className="min-w-0 space-y-2 rounded-xl bg-card p-3 ring-1 ring-inset ring-border xl:p-2" data-testid={`availability-${day.date}`}>
            <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
              <h3 className="min-w-0 text-base font-semibold">
                <Link
                  to={agendaHref('day', day.date, today)}
                  className="inline-flex min-h-11 items-center rounded-md hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {formatStayDate(day.date, i18n.language, { weekday: 'short', day: 'numeric', month: 'short' })}
                </Link>
              </h3>
              {day.date === today ? (
                <span className="rounded-full bg-primary-soft px-2 py-0.5 text-xs font-semibold text-primary-text">{t('supplier.agenda.today')}</span>
              ) : null}
            </div>
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
              <DayStateLabel state={state} />
              {pendingDates.has(day.date) ? <PendingDayBadge date={day.date} /> : null}
            </p>
            {day.bands.length > 0 ? (
              <p className="break-words text-xs text-foreground/70" data-testid={`availability-hours-${day.date}`}>
                {formatBands(day.bands)}
              </p>
            ) : null}
            {day.events.length > 0 ? (
              <ul role="list" data-testid={`availability-events-${day.date}`} className="divide-y divide-border border-t border-border">
                {day.events.map((event) => (
                  <AgendaEventItem key={event.id} event={event} layout="stack" />
                ))}
              </ul>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
