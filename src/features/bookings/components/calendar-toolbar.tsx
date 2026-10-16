import { Building2, ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Segmented } from '@/components/ui/segmented';
import { Select } from '@/components/ui/select';
import { todayInRome } from '@/lib/stay-dates';
import {
  HOST_CALENDAR_VIEWS,
  hostCalendarLabel,
  shiftHostCalendarDate,
  type HostCalendarView,
} from '../lib/host-calendar';

interface CalendarToolbarProps {
  properties: readonly { id: string; name: string }[];
  propertyId: string;
  onPropertyChange: (propertyId: string) => void;
  view: HostCalendarView;
  /** The day the view is around (`YYYY-MM-DD`). */
  date: string;
  onViewChange: (view: HostCalendarView) => void;
  onDateChange: (date: string) => void;
  /** The period is not offered while the calendar cannot be shown (the load failed): only the property is. */
  showPeriod: boolean;
}

/**
 * The filters of the calendar, in one row like the lists of the redesign: the property, how much is shown (month, week, day)
 * and where (back, today, forward, with what is on show said in words). The property is still the `<select id="calendar-property">`
 * that the end-to-end tests drive.
 */
export function CalendarToolbar({
  properties,
  propertyId,
  onPropertyChange,
  view,
  date,
  onViewChange,
  onDateChange,
  showPeriod,
}: CalendarToolbarProps) {
  const { t, i18n } = useTranslation();

  return (
    <div role="group" aria-label={t('booking.calendar.filters.label')} className="flex flex-wrap items-center gap-x-3 gap-y-2" data-testid="calendar-filters">
      <div className="relative w-full min-w-0 sm:w-64">
        <label htmlFor="calendar-property" className="sr-only">
          {t('booking.calendar.property')}
        </label>
        <Building2 className="pointer-events-none absolute left-3 top-1/2 z-[2] size-4 -translate-y-1/2 text-foreground/60" aria-hidden="true" />
        <Select
          id="calendar-property"
          value={propertyId}
          className="pl-9"
          onChange={(event) => onPropertyChange(event.target.value)}
        >
          {properties.map((property) => (
            <option key={property.id} value={property.id}>
              {property.name}
            </option>
          ))}
        </Select>
      </div>

      {showPeriod && (
        <>
          <Segmented
            label={t('booking.calendar.filters.view')}
            value={view}
            onValueChange={onViewChange}
            options={HOST_CALENDAR_VIEWS.map((value) => ({ value, label: t(`booking.calendar.toolbar.${value}`) }))}
          />
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 md:ml-auto" role="group" aria-label={t('booking.calendar.filters.period')}>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label={t('booking.calendar.toolbar.previous')}
                onClick={() => onDateChange(shiftHostCalendarDate(view, date, -1))}
              >
                <ChevronLeft className="size-4" aria-hidden="true" />
              </Button>
              <Button type="button" variant="outline" onClick={() => onDateChange(todayInRome())}>
                {t('booking.calendar.toolbar.today')}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label={t('booking.calendar.toolbar.next')}
                onClick={() => onDateChange(shiftHostCalendarDate(view, date, 1))}
              >
                <ChevronRight className="size-4" aria-hidden="true" />
              </Button>
            </div>
            <p className="min-w-0 break-words text-base font-semibold tabular-nums first-letter:uppercase" aria-live="polite" aria-atomic="true">
              {hostCalendarLabel(view, date, i18n.language)}
            </p>
          </div>
        </>
      )}
    </div>
  );
}
