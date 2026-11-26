import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { isStayDate } from '@/lib/stay-dates';
import { Segmented } from '@/components/ui/segmented';
import { AGENDA_VIEWS, agendaLabel, shiftAgendaDate, type AgendaView } from '../lib/agenda-range';

interface AgendaToolbarProps {
  view: AgendaView;
  /** The day the view is around (`YYYY-MM-DD`). */
  date: string;
  today: string;
  onViewChange: (view: AgendaView) => void;
  onDateChange: (date: string) => void;
}

/**
 * How much of the agenda is shown (day, week, month) and where (back, today, forward), with what is on show said in words.
 * The words are the `h2` of the agenda and a live region: moving the period tells a screen reader where it landed.
 */
export function AgendaToolbar({ view, date, today, onViewChange, onDateChange }: AgendaToolbarProps) {
  const { t, i18n } = useTranslation();

  return (
    <div className="space-y-3 rounded-xl bg-muted/60 p-3" data-testid="agenda-toolbar">
      <h2 className="break-words text-lg font-semibold first-letter:uppercase" aria-live="polite" aria-atomic="true" data-testid="agenda-label">
        {agendaLabel(view, date, i18n.language)}
      </h2>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-3">
        <Segmented<AgendaView>
          label={t('supplier.agenda.views.label')}
          value={view}
          onValueChange={onViewChange}
          options={AGENDA_VIEWS.map((value) => ({ value, label: t(`supplier.agenda.views.${value}`), testId: `agenda-view-${value}` }))}
        />
        <div role="group" aria-label={t('supplier.agenda.period')} className="flex max-w-full flex-wrap items-center gap-1">
          <label className="me-1 flex min-w-0 items-center gap-2 text-sm font-medium">
            {t('booking.calendar.toolbar.date')}
            <Input type="date" value={date} className="min-h-11 w-auto max-w-full" onChange={(event) => {
              if (isStayDate(event.target.value)) onDateChange(event.target.value);
            }} />
          </label>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label={t('supplier.agenda.previous')}
            data-testid="agenda-previous"
            onClick={() => onDateChange(shiftAgendaDate(view, date, -1))}
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
          </Button>
          <Button type="button" variant="outline" data-testid="agenda-today" onClick={() => onDateChange(today)}>
            {t('supplier.agenda.today')}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label={t('supplier.agenda.next')}
            data-testid="agenda-next"
            onClick={() => onDateChange(shiftAgendaDate(view, date, 1))}
          >
            <ChevronRight className="size-4" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </div>
  );
}
