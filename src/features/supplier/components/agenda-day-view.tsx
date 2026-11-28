import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { dayStateOf, formatBands, type WorkingDayView } from '../lib/supplier-agenda';
import { AgendaEventItem, DayStateLabel, PendingDayBadge } from './agenda-event-item';

interface AgendaDayViewProps {
  day: WorkingDayView;
  today: string;
  pending: boolean;
  busy: boolean;
  onToggle: (open: boolean) => void;
}

export function AgendaDayView({ day, today, pending, busy, onToggle }: AgendaDayViewProps) {
  const { t } = useTranslation();
  const state = dayStateOf(day);
  const toggleable =
    !pending && day.date >= today && day.bands.length > 0 && (state === 'open' || state === 'closed' || state === 'closedByCalendar');
  const reopens = state !== 'open';

  return (
    <div className="space-y-4" data-testid={`availability-${day.date}`}>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <div className="min-w-0 space-y-1">
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <DayStateLabel state={state} />
            {pending ? <PendingDayBadge date={day.date} /> : null}
          </p>
          <p className="break-words text-sm text-foreground/70" data-testid={`availability-hours-${day.date}`}>
            {day.bands.length > 0 ? `${t('supplier.workingHoursLabel')}: ${formatBands(day.bands)}` : t('supplier.noWorkingHoursToday')}
          </p>
        </div>
        {toggleable ? (
          <Button type="button" variant="outline" loading={busy} data-testid="agenda-toggle-day" onClick={() => onToggle(reopens)}>
            {reopens ? t('supplier.agenda.reopen') : t('supplier.agenda.close')}
          </Button>
        ) : null}
      </div>

      {day.events.length > 0 ? (
        <ul role="list" data-testid={`availability-events-${day.date}`} className="divide-y divide-border border-y border-border">
          {day.events.map((event) => (
            <AgendaEventItem key={event.id} event={event} layout="row" />
          ))}
        </ul>
      ) : (
        <p className="text-foreground/70">{t('supplier.agenda.dayEmpty')}</p>
      )}
    </div>
  );
}
