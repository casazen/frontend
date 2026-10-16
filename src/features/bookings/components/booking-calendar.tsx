import { useCallback, useMemo } from 'react';
import {
  Calendar,
  dateFnsLocalizer,
  type EventProps,
  type Messages,
  type NavigateAction,
  type SlotInfo,
  type View,
} from 'react-big-calendar';
import { format, getDay, startOfWeek, type Locale } from 'date-fns';
import { enGB, it } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import './host-calendar.css';
import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { getBookingStatusLabel } from '@/lib/i18n-labels';
import { formatStayDate, stayDateToLocalDate, toStayDate, todayInRome } from '@/lib/stay-dates';
import { calendarKindInfo, calendarKindOf } from '../lib/calendar-kinds';
import {
  HOST_CALENDAR_VIEWS,
  HOST_CALENDAR_WEEK_STARTS_ON,
  blockSourceLabel,
  isHostCalendarView,
  type HostCalendarEvent,
  type HostCalendarView,
} from '../lib/host-calendar';
import { CalendarLegend } from './calendar-legend';

const CALENDAR_LOCALES: Record<string, Locale> = { it, en: enGB };

// Weeks start on Monday in every language, like the range asked to the API (hostCalendarRange).
const localizer = dateFnsLocalizer({
  format,
  getDay,
  startOfWeek: (date: Date, options?: { locale?: Locale }) =>
    startOfWeek(date, { ...options, weekStartsOn: HOST_CALENDAR_WEEK_STARTS_ON }),
  locales: CALENDAR_LOCALES,
});

function eventTitle(event: HostCalendarEvent, t: TFunction): string {
  if (event.kind === 'block') return blockSourceLabel(event, t);
  return event.guestName || t('booking.calendar.guestUnknown');
}

/**
 * What an entry shows on the grid: its icon and its title, and for a screen reader the kind in words (the color and the shape
 * of the box are for the eyes; the icon and the word are there so that nothing depends on them).
 */
function CalendarEvent({ event }: EventProps<HostCalendarEvent>) {
  const { t } = useTranslation();
  const { icon: Icon, labelKey } = calendarKindInfo(calendarKindOf(event));
  return (
    <span className="host-calendar-event__body">
      <Icon className="host-calendar-event__icon" aria-hidden="true" />
      <span className="host-calendar-event__title">{eventTitle(event, t)}</span>
      <span className="sr-only">{t(labelKey)}</span>
    </span>
  );
}

const CALENDAR_COMPONENTS = { event: CalendarEvent };

interface BookingCalendarProps {
  events: HostCalendarEvent[];
  /** Day shown (`YYYY-MM-DD`): the month, the week or the day around it. */
  date: string;
  view: HostCalendarView;
  onNavigate: (date: string) => void;
  onView: (view: HostCalendarView) => void;
  onSelectEvent?: (event: HostCalendarEvent) => void;
  onSelectSlot?: (slotInfo: SlotInfo) => void;
  /** The entries of the range are loading: the grid stays, with a loading overlay. */
  loading?: boolean;
}

/**
 * The grid of the host calendar: the library draws it (month, week, day) and `host-calendar.css` dresses it with the tokens.
 * The legend sits above it; the arrows, the view and the label of the period are the toolbar of the page (`CalendarToolbar`),
 * so the library's own toolbar is off.
 */
export function BookingCalendar({
  events,
  date,
  view,
  onNavigate,
  onView,
  onSelectEvent,
  onSelectSlot,
  loading = false,
}: BookingCalendarProps) {
  const { t, i18n } = useTranslation();
  const culture = i18n.language?.startsWith('en') ? 'en' : 'it';
  const shownDate = useMemo(() => stayDateToLocalDate(date) ?? new Date(), [date]);

  const messages = useMemo<Messages<HostCalendarEvent>>(
    () => ({
      today: t('booking.calendar.toolbar.today'),
      previous: t('booking.calendar.toolbar.previous'),
      next: t('booking.calendar.toolbar.next'),
      month: t('booking.calendar.toolbar.month'),
      week: t('booking.calendar.toolbar.week'),
      day: t('booking.calendar.toolbar.day'),
      allDay: t('booking.calendar.toolbar.allDay'),
      date: t('booking.calendar.toolbar.date'),
      time: t('booking.calendar.toolbar.time'),
      event: t('booking.calendar.toolbar.event'),
      noEventsInRange: t('booking.calendar.toolbar.noEventsInRange'),
      showMore: (count: number) => t('booking.calendar.toolbar.showMore', { count }),
    }),
    [t],
  );

  const handleNavigate = useCallback(
    (newDate: Date, _view: View, action: NavigateAction) => {
      // "Today" is the calendar date in Rome, whatever the time zone of the browser.
      onNavigate(action === 'TODAY' ? todayInRome() : toStayDate(newDate));
    },
    [onNavigate],
  );

  const handleView = useCallback(
    (next: View) => {
      if (isHostCalendarView(next)) onView(next);
    },
    [onView],
  );

  const tooltip = useCallback(
    (event: HostCalendarEvent) => {
      const dates = t('booking.calendar.dates', {
        arrival: formatStayDate(event.arrival, i18n.language),
        departure: formatStayDate(event.departure, i18n.language),
        count: event.nights,
      });
      const what =
        event.kind === 'block'
          ? event.manual
            ? t('booking.calendar.manualBlock.tooltip', { reason: blockSourceLabel(event, t) })
            : t('booking.calendar.block.tooltip', { source: blockSourceLabel(event, t) })
          : event.otaReviewReason
            ? `${eventTitle(event, t)} · ${getBookingStatusLabel(event.status, t)} · ${t('booking.otaReview.badge')}`
            : `${eventTitle(event, t)} · ${getBookingStatusLabel(event.status, t)}`;
      return `${what} · ${dates}`;
    },
    [t, i18n.language],
  );

  return (
    <div className="flex flex-1 flex-col gap-3">
      <CalendarLegend />
      <div className={`host-calendar host-calendar--${view}`} aria-busy={loading}>
        <Calendar<HostCalendarEvent>
          localizer={localizer}
          culture={culture}
          messages={messages}
          events={events}
          date={shownDate}
          view={view}
          views={[...HOST_CALENDAR_VIEWS]}
          toolbar={false}
          components={CALENDAR_COMPONENTS}
          onNavigate={handleNavigate}
          onView={handleView}
          startAccessor="start"
          endAccessor="end"
          allDayAccessor="allDay"
          titleAccessor={(event) => eventTitle(event, t)}
          tooltipAccessor={tooltip}
          onSelectEvent={onSelectEvent}
          onSelectSlot={onSelectSlot}
          selectable={Boolean(onSelectSlot)}
          eventPropGetter={(event) => ({ className: `host-calendar-event host-calendar-event--${calendarKindOf(event)}` })}
        />
        {loading && (
          <div
            role="status"
            className="absolute inset-0 z-10 flex items-center justify-center gap-2 bg-card/70 text-sm font-medium"
          >
            <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
            {t('booking.calendar.loading')}
          </div>
        )}
        {!loading && events.length === 0 && (
          <p className="pointer-events-none absolute inset-x-0 bottom-4 z-10 mx-auto w-fit max-w-[calc(100%-2rem)] rounded-full border bg-card px-4 py-1.5 text-center text-sm text-foreground/70">
            {t('booking.calendar.toolbar.noEventsInRange')}
          </p>
        )}
      </div>
    </div>
  );
}
