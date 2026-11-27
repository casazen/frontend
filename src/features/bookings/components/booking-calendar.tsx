import { Children, cloneElement, createContext, useCallback, useContext, useMemo, type KeyboardEvent, type ReactElement, type ReactNode } from 'react';
import {
  Calendar,
  dateFnsLocalizer,
  type DateCellWrapperProps,
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
import { addDays, formatStayDate, stayDateToLocalDate, toStayDate, todayInRome } from '@/lib/stay-dates';
import { cn } from '@/lib/utils';
import { calendarKindInfo, calendarKindOf } from '../lib/calendar-kinds';
import { dayLabel, showsPrice, type DayLayerProperty } from '../lib/day-layer';
import { isDaySelected, type DaySelection } from '../lib/day-selection';
import {
  HOST_CALENDAR_VIEWS,
  HOST_CALENDAR_WEEK_STARTS_ON,
  blockSourceLabel,
  hostCalendarRange,
  isHostCalendarView,
  type HostCalendarEvent,
  type HostCalendarView,
} from '../lib/host-calendar';
import { CHANNEL_ICONS, bookingChannelName, channelOf } from '../lib/ota-stay';
import { useUnreadMessagesOf } from '../lib/unread-messages-context';
import { CalendarLegend } from './calendar-legend';
import { DayCellContent } from './day-cell-content';
import { UnreadMessagesBadge } from '@/components/shared/unread-messages-badge';

const CALENDAR_LOCALES: Record<string, Locale> = { it, en: enGB };

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
  const unread = useUnreadMessagesOf(event.kind === 'booking' ? event.id : null);
  const channel = event.kind === 'booking' && event.source ? channelOf(event.source) : null;
  const ChannelIcon = channel ? CHANNEL_ICONS[channel] : null;
  return (
    <span className="host-calendar-event__body">
      <Icon className="host-calendar-event__icon" aria-hidden="true" />
      <span className="host-calendar-event__title">{eventTitle(event, t)}</span>
      <span className="sr-only">{t(labelKey)}</span>
      {channel && ChannelIcon ? (
        <span className="host-calendar-event__channel" data-testid="calendar-event-channel">
          <ChannelIcon className="host-calendar-event__icon" aria-hidden="true" />
          {bookingChannelName(channel, t)}
        </span>
      ) : null}
      <UnreadMessagesBadge count={unread} className="ml-auto" />
    </span>
  );
}

interface DayCellContextValue {
  propertyId: string;
  propertyName: string;
  layer?: DayLayerProperty;
  today: string;
  selection: DaySelection | null;
  tabbableDay: string;
  onPressDay?: (propertyId: string, day: string, shift: boolean, origin?: string) => void;
  onClearSelection?: () => void;
}

const DayCellContext = createContext<DayCellContextValue | null>(null);

function DayCellWrapper({ value, children }: DateCellWrapperProps) {
  const { t, i18n } = useTranslation();
  const context = useContext(DayCellContext);
  const cell = Children.only(children) as ReactElement<{ className?: string; children?: ReactNode }>;
  if (!context) return cell;

  const day = toStayDate(value);
  const info = context.layer?.days.get(day);
  const selected = isDaySelected(context.selection, context.propertyId, day);
  const past = day < context.today;
  const { onPressDay, tabbableDay } = context;

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!onPressDay) return;
    const grid = event.currentTarget.closest<HTMLElement>('.host-calendar');
    const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[event.key as 'ArrowLeft'];
    if (step !== undefined) {
      event.preventDefault();
      const target = addDays(day, step);
      if (event.shiftKey) onPressDay(context.propertyId, target, true, day);
      Array.from(grid?.querySelectorAll<HTMLElement>('[data-day-cell]') ?? [])
        .find((candidate) => candidate.dataset.dayCell === target)
        ?.focus();
    } else if (event.key === 'Escape' && context.selection) {
      event.preventDefault();
      context.onClearSelection?.();
    }
  };

  return cloneElement(
    cell,
    { className: cn(cell.props.className, past && 'host-calendar-past', selected && 'is-selected') },
    cell.props.children,
    context.layer && showsPrice(info, day, context.today) ? <DayCellContent key="content" info={info} currency={context.layer.currency} zoom={1} /> : null,
    onPressDay ? (
      <button
        key="button"
        type="button"
        className="host-calendar-daybutton"
        data-day-cell={day}
        aria-pressed={selected}
        aria-label={dayLabel({ date: day, propertyName: context.propertyName, today: context.today, language: i18n.language, currency: context.layer?.currency, info }, t)}
        tabIndex={day === tabbableDay ? 0 : -1}
        onClick={(event) => {
          if (event.detail === 0) onPressDay(context.propertyId, day, event.shiftKey);
        }}
        onKeyDown={handleKeyDown}
      />
    ) : null,
  );
}

const CALENDAR_COMPONENTS = { event: CalendarEvent, dateCellWrapper: DayCellWrapper };

interface BookingCalendarProps {
  events: HostCalendarEvent[];
  date: string;
  view: HostCalendarView;
  onNavigate: (date: string) => void;
  onView: (view: HostCalendarView) => void;
  onSelectEvent?: (event: HostCalendarEvent) => void;
  onSelectSlot?: (slotInfo: SlotInfo) => void;
  loading?: boolean;
  property?: { id: string; name: string };
  dayLayer?: DayLayerProperty;
  selection?: DaySelection | null;
  onPressDay?: (propertyId: string, day: string, shift: boolean, origin?: string) => void;
  onClearSelection?: () => void;
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
  property,
  dayLayer,
  selection = null,
  onPressDay,
  onClearSelection,
}: BookingCalendarProps) {
  const { t, i18n } = useTranslation();
  const culture = i18n.language?.startsWith('en') ? 'en' : 'it';
  const shownDate = useMemo(() => stayDateToLocalDate(date) ?? new Date(), [date]);

  const today = todayInRome();
  const dayCells = useMemo<DayCellContextValue | null>(() => {
    if (!property || (!dayLayer && !onPressDay)) return null;
    const range = hostCalendarRange(view, date);
    const inRange = (day: string) => day >= range.startDate && day <= range.endDate;
    const tabbableDay = selection && selection.propertyId === property.id && inRange(selection.to) ? selection.to : inRange(today) ? today : range.startDate;
    return { propertyId: property.id, propertyName: property.name, layer: dayLayer, today, selection, tabbableDay, onPressDay, onClearSelection };
  }, [property, dayLayer, today, selection, onPressDay, onClearSelection, view, date]);

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
      const channel = event.kind === 'booking' && event.source ? ` · ${bookingChannelName(channelOf(event.source), t)}` : '';
      return `${what}${channel} · ${dates}`;
    },
    [t, i18n.language],
  );

  return (
    <DayCellContext.Provider value={dayCells}>
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
    </DayCellContext.Provider>
  );
}
