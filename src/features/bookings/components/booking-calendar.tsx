import { useCallback, useMemo, type CSSProperties } from 'react';
import { Calendar, dateFnsLocalizer, type Messages, type NavigateAction, type SlotInfo, type View } from 'react-big-calendar';
import { format, getDay, startOfWeek, type Locale } from 'date-fns';
import { enGB, it } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { getBookingStatusLabel } from '@/lib/i18n-labels';
import { formatStayDate, stayDateToLocalDate, toStayDate, todayInRome } from '@/lib/stay-dates';
import {
  HOST_CALENDAR_VIEWS,
  HOST_CALENDAR_WEEK_STARTS_ON,
  blockSourceLabel,
  isHostCalendarView,
  type HostCalendarEvent,
  type HostCalendarView,
} from '../lib/host-calendar';

const CALENDAR_LOCALES: Record<string, Locale> = { it, en: enGB };

// Weeks start on Monday in every language, like the range asked to the API (hostCalendarRange).
const localizer = dateFnsLocalizer({
  format,
  getDay,
  startOfWeek: (date: Date, options?: { locale?: Locale }) =>
    startOfWeek(date, { ...options, weekStartsOn: HOST_CALENDAR_WEEK_STARTS_ON }),
  locales: CALENDAR_LOCALES,
});

type LegendKey = 'Confirmed' | 'Pending' | 'CheckedIn' | 'CheckedOut' | 'toReview' | 'block';

/**
 * One style per kind of entry, used by the events and by the legend. Pending requests (BK-06: "pay at the property"
 * waiting for the host, checkout in progress) are dashed and light, so they never read as confirmed stays.
 */
const EVENT_STYLES: Record<LegendKey, CSSProperties> = {
  Confirmed: { backgroundColor: '#2563eb', color: '#ffffff', border: '1px solid #2563eb' },
  Pending: { backgroundColor: '#fef3c7', color: '#78350f', border: '1px dashed #b45309' },
  CheckedIn: { backgroundColor: '#047857', color: '#ffffff', border: '1px solid #047857' },
  CheckedOut: { backgroundColor: '#6b7280', color: '#ffffff', border: '1px solid #6b7280' },
  // OTA stay created from an iCal block that a sync marked "da verificare" (CO-21): the reservation changed on the channel.
  toReview: { backgroundColor: '#fff7ed', color: '#9a3412', border: '2px solid #ea580c' },
  block: { backgroundColor: '#9333ea', color: '#ffffff', border: '1px solid #9333ea' },
};

const LEGEND: { key: LegendKey; labelKey: string }[] = [
  { key: 'Confirmed', labelKey: 'booking.calendar.legend.confirmed' },
  { key: 'Pending', labelKey: 'booking.calendar.legend.pending' },
  { key: 'CheckedIn', labelKey: 'booking.calendar.legend.checkedIn' },
  { key: 'CheckedOut', labelKey: 'booking.calendar.legend.checkedOut' },
  { key: 'toReview', labelKey: 'booking.calendar.legend.toReview' },
  { key: 'block', labelKey: 'booking.calendar.legend.block' },
];

function styleKey(event: HostCalendarEvent): LegendKey {
  if (event.kind === 'block') return 'block';
  if (event.otaReviewReason) return 'toReview';
  return event.status === 'Pending' || event.status === 'CheckedIn' || event.status === 'CheckedOut'
    ? event.status
    : 'Confirmed';
}

function eventTitle(event: HostCalendarEvent, t: TFunction): string {
  if (event.kind === 'block') return blockSourceLabel(event, t);
  return event.guestName || t('booking.calendar.guestUnknown');
}

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
          ? t('booking.calendar.block.tooltip', { source: blockSourceLabel(event, t) })
          : event.otaReviewReason
            ? `${eventTitle(event, t)} · ${getBookingStatusLabel(event.status, t)} · ${t('booking.otaReview.badge')}`
            : `${eventTitle(event, t)} · ${getBookingStatusLabel(event.status, t)}`;
      return `${what} · ${dates}`;
    },
    [t, i18n.language],
  );

  return (
    <div className="space-y-3">
      <ul className="flex flex-wrap gap-4 text-sm text-muted-foreground" aria-label={t('booking.calendar.legend.title')}>
        {LEGEND.map((entry) => (
          <li key={entry.key} className="inline-flex items-center gap-2">
            <span className="h-3 w-3 rounded" style={EVENT_STYLES[entry.key]} aria-hidden="true" />
            {t(entry.labelKey)}
          </li>
        ))}
      </ul>
      <div className="relative h-[600px] rounded-lg border bg-white p-4" aria-busy={loading}>
        <Calendar<HostCalendarEvent>
          localizer={localizer}
          culture={culture}
          messages={messages}
          events={events}
          date={shownDate}
          view={view}
          views={[...HOST_CALENDAR_VIEWS]}
          onNavigate={handleNavigate}
          onView={handleView}
          startAccessor="start"
          endAccessor="end"
          allDayAccessor="allDay"
          titleAccessor={(event) => eventTitle(event, t)}
          tooltipAccessor={tooltip}
          style={{ height: '100%' }}
          onSelectEvent={onSelectEvent}
          onSelectSlot={onSelectSlot}
          selectable={Boolean(onSelectSlot)}
          eventPropGetter={(event) => ({
            className: `host-calendar-event host-calendar-event--${styleKey(event)}`,
            style: { ...EVENT_STYLES[styleKey(event)], borderRadius: '5px', display: 'block' },
          })}
        />
        {loading && (
          <div
            role="status"
            className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-white/70 text-sm font-medium"
          >
            {t('booking.calendar.loading')}
          </div>
        )}
      </div>
    </div>
  );
}
