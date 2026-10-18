import { Building2, ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Segmented } from '@/components/ui/segmented';
import { Select } from '@/components/ui/select';
import { todayInRome } from '@/lib/stay-dates';
import { hostCalendarLabel, shiftHostCalendarDate } from '../lib/host-calendar';
import {
  CALENDAR_PAGE_VIEWS,
  TIMELINE_ZOOMS,
  resolveCalendarAnchor,
  shiftTimelineStart,
  timelineLabel,
  type CalendarPageView,
  type TimelineZoom,
} from '../lib/host-timeline';

interface CalendarToolbarProps {
  properties: readonly { id: string; name: string }[];
  /** The property shown; empty is every property, which only the Timeline can show. */
  propertyId: string;
  onPropertyChange: (propertyId: string) => void;
  view: CalendarPageView;
  /** How many days the Timeline shows. */
  zoom: TimelineZoom;
  /** The day the view is around (`YYYY-MM-DD`); in the Timeline, its first day. */
  date: string;
  onViewChange: (view: CalendarPageView) => void;
  onZoomChange: (zoom: TimelineZoom) => void;
  onDateChange: (date: string) => void;
  /** The period is not offered while the calendar cannot be shown (the load failed): only the property is. */
  showPeriod: boolean;
}

/**
 * The filters of the calendar, in one row like the lists of the redesign: the property, how it is shown (the Timeline of every
 * property, or the month, the week or the day of one), for the Timeline how many days, and where (back, today, forward, with what
 * is on show said in words). The property is still the `<select id="calendar-property">` that the end-to-end tests drive.
 */
export function CalendarToolbar({
  properties,
  propertyId,
  onPropertyChange,
  view,
  zoom,
  date,
  onViewChange,
  onZoomChange,
  onDateChange,
  showPeriod,
}: CalendarToolbarProps) {
  const { t, i18n } = useTranslation();
  const timeline = view === 'timeline';

  const shift = (direction: -1 | 1) =>
    onDateChange(timeline ? shiftTimelineStart(date, zoom, direction) : shiftHostCalendarDate(view, date, direction));

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
          {timeline ? <option value="">{t('booking.calendar.timeline.allProperties')}</option> : null}
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
            options={CALENDAR_PAGE_VIEWS.map((value) => ({ value, label: t(`booking.calendar.toolbar.${value}`) }))}
          />
          {timeline ? (
            <Segmented
              label={t('booking.calendar.timeline.zoom')}
              value={String(zoom) as `${TimelineZoom}`}
              onValueChange={(value) => onZoomChange(Number(value) as TimelineZoom)}
              options={TIMELINE_ZOOMS.map((days) => ({
                value: String(days) as `${TimelineZoom}`,
                label: (
                  <>
                    {days}
                    <span className="sr-only"> {t('booking.calendar.timeline.days')}</span>
                  </>
                ),
              }))}
            />
          ) : null}
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 md:ml-auto" role="group" aria-label={t('booking.calendar.filters.period')}>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label={t('booking.calendar.toolbar.previous')}
                onClick={() => shift(-1)}
              >
                <ChevronLeft className="size-4" aria-hidden="true" />
              </Button>
              <Button type="button" variant="outline" onClick={() => onDateChange(resolveCalendarAnchor(null, view, todayInRome()))}>
                {t('booking.calendar.toolbar.today')}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label={t('booking.calendar.toolbar.next')}
                onClick={() => shift(1)}
              >
                <ChevronRight className="size-4" aria-hidden="true" />
              </Button>
            </div>
            <p className="min-w-0 break-words text-base font-semibold tabular-nums first-letter:uppercase" aria-live="polite" aria-atomic="true">
              {timeline ? timelineLabel(date, zoom, i18n.language) : hostCalendarLabel(view, date, i18n.language)}
            </p>
          </div>
        </>
      )}
    </div>
  );
}
