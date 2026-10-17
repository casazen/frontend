import {
  addDays,
  endOfMonth,
  formatStayDate,
  nightsBetween,
  parseStayDate,
  startOfMonth,
  startOfWeek,
  stayDateToLocalDate,
  utcStayDate,
} from '@/lib/stay-dates';
import type { TFunction } from 'i18next';
import {
  MANUAL_BLOCK_REASONS,
  MODE_CHANGE_BLOCK_REASON,
  type BlockReason,
  type CalendarItemDto,
  type OtaReviewReason,
} from '@/types/calendar.types';
import type { HostCalendarBlockItem, HostCalendarIcalItem } from '@/types/host-calendar.types';

/**
 * Host calendar of the web console (PC-08, A2-06): the range asked to `GET /api/bookings/calendar` follows the view and
 * the date shown by react-big-calendar, and the entries of the API become calendar events without time-zone shifts.
 */

export const HOST_CALENDAR_VIEWS = ['month', 'week', 'day'] as const;
export type HostCalendarView = (typeof HOST_CALENDAR_VIEWS)[number];

/** Weeks start on Monday (Italian and ISO 8601 convention) in every language: the calendar is of a property in Italy. */
export const HOST_CALENDAR_WEEK_STARTS_ON = 1;

export function isHostCalendarView(value: string): value is HostCalendarView {
  return (HOST_CALENDAR_VIEWS as readonly string[]).includes(value);
}

/**
 * Stay dates asked to the API for `view` around `date`, both ends included (backend MO-06): the month from its first to
 * its last day, the week from Monday to Sunday, or the day itself.
 */
export function hostCalendarRange(view: HostCalendarView, date: string): { startDate: string; endDate: string } {
  switch (view) {
    case 'week': {
      const startDate = startOfWeek(date, HOST_CALENDAR_WEEK_STARTS_ON);
      return { startDate, endDate: addDays(startDate, 6) };
    }
    case 'day':
      return { startDate: date, endDate: date };
    default:
      return { startDate: startOfMonth(date), endDate: endOfMonth(date) };
  }
}

/** `date` moved by `months` months, keeping the day of the month or, in a shorter month, its last day (31 January + 1 = 28 February). */
function addMonths(date: string, months: number): string {
  const first = startOfMonth(date);
  if (!first) return '';
  const [year, month] = first.split('-').map(Number);
  const targetFirst = utcStayDate(new Date(Date.UTC(year, month - 1 + months, 1)));
  const lastDay = Number(endOfMonth(targetFirst).slice(8, 10));
  return addDays(targetFirst, Math.min(Number(date.slice(8, 10)), lastDay) - 1);
}

/** The day to show after the arrows of the toolbar: one month, one week or one day back (`-1`) or forward (`1`). */
export function shiftHostCalendarDate(view: HostCalendarView, date: string, direction: -1 | 1): string {
  switch (view) {
    case 'week':
      return addDays(date, direction * 7);
    case 'day':
      return addDays(date, direction);
    default:
      return addMonths(date, direction);
  }
}

/** What the toolbar says the calendar is showing: "settembre 2026", "21–27 settembre 2026" or "giovedì 24 settembre 2026". */
export function hostCalendarLabel(view: HostCalendarView, date: string, language: string): string {
  switch (view) {
    case 'week': {
      const { startDate, endDate } = hostCalendarRange('week', date);
      const sameYear = startDate.slice(0, 4) === endDate.slice(0, 4);
      if (sameYear && startDate.slice(0, 7) === endDate.slice(0, 7)) {
        const from = formatStayDate(startDate, language, { day: 'numeric' });
        return `${from}–${formatStayDate(endDate, language, { day: 'numeric', month: 'long', year: 'numeric' })}`;
      }
      const from = formatStayDate(startDate, language, sameYear ? { day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short', year: 'numeric' });
      return `${from} – ${formatStayDate(endDate, language, { day: 'numeric', month: 'short', year: 'numeric' })}`;
    }
    case 'day':
      return formatStayDate(date, language, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    default:
      return formatStayDate(date, language, { month: 'long', year: 'numeric' });
  }
}

/** Channel of an imported feed as the API names it (`ICalFeedChannel`). */
export const HOST_CALENDAR_CHANNELS = ['Airbnb', 'BookingCom', 'Other'] as const;
export type HostCalendarChannel = (typeof HOST_CALENDAR_CHANNELS)[number];

interface HostCalendarEventBase {
  id: string;
  /** Arrival day (`YYYY-MM-DD`). */
  arrival: string;
  /** Departure day (`YYYY-MM-DD`): the guest leaves that morning, the day is free for a new arrival. */
  departure: string;
  nights: number;
  /** Local midnight of the arrival day. */
  start: Date;
  /**
   * Local midnight of the departure day. react-big-calendar treats an end at midnight as exclusive, so the bar covers
   * the nights, from the arrival day to the day before the departure: the day of a check-out stays free for the next
   * check-in. The departure day is shown in the tooltip ("arrival → departure", as in the app, MO-06).
   */
  end: Date;
  allDay: true;
}

/** A booking: it opens the booking detail. */
export interface HostCalendarBookingEvent extends HostCalendarEventBase {
  kind: 'booking';
  status: string;
  guestName: string;
  /** OTA stay created from an iCal block that a sync marked "da verificare" (CO-21); null otherwise. */
  otaReviewReason: OtaReviewReason | null;
}

/**
 * Dates taken on another channel (an `ical-block` of an imported feed, or any entry that is not a booking): no guest and
 * no booking detail, its `id` is not a booking.
 */
export interface HostCalendarBlockEvent extends HostCalendarEventBase {
  kind: 'block';
  channel: HostCalendarChannel | null;
  feedLabel: string | null;
  summary: string | null;
  /** Entered by hand by the host, not imported from a feed. */
  manual: boolean;
  /**
   * Why the dates are closed (manual block only, PC-09); `Other` for an unknown value. `ModeChange` is the block the system
   * writes for a change of rental mode (PM-02): the host does not choose it and cannot delete it.
   */
  reason: BlockReason | null;
  /** The OTA stay the host created from this block (CO-21), while not cancelled. */
  stayId: string | null;
  /** "Crea soggiorno OTA" is offered (CO-21): imported, not a stay yet, not over. */
  convertible: boolean;
}

export type HostCalendarEvent = HostCalendarBookingEvent | HostCalendarBlockEvent;

function toChannel(value: string | null | undefined): HostCalendarChannel | null {
  return HOST_CALENDAR_CHANNELS.find((channel) => channel === value) ?? null;
}

function toReason(manual: boolean, value: string | null | undefined): BlockReason | null {
  if (!manual) return null;
  if (value === MODE_CHANGE_BLOCK_REASON) return MODE_CHANGE_BLOCK_REASON;
  return MANUAL_BLOCK_REASONS.find((reason) => reason === value) ?? 'Other';
}

function trimmed(value: string | null | undefined): string | null {
  const text = value?.trim();
  return text ? text : null;
}

/**
 * Events of the calendar from the `items` of the API. Their dates are stay dates without time zone
 * (`2026-09-30T00:00:00`): the day is read as written and placed at the local midnight of that day, so an arrival on the
 * 30th is on the 30th in any time zone of the browser. An entry whose departure is not after its arrival is shown on its
 * arrival day; an entry without valid dates is left out.
 */
export function toHostCalendarEvents(items: readonly CalendarItemDto[]): HostCalendarEvent[] {
  const events: HostCalendarEvent[] = [];
  for (const item of items) {
    const arrival = parseStayDate(item.startDate);
    const parsedDeparture = parseStayDate(item.endDate);
    if (!arrival || !parsedDeparture) continue;
    const departure = parsedDeparture > arrival ? parsedDeparture : addDays(arrival, 1);
    const start = stayDateToLocalDate(arrival);
    const end = stayDateToLocalDate(departure);
    if (!start || !end) continue;

    const base = { id: item.id, arrival, departure, nights: nightsBetween(arrival, parsedDeparture), start, end, allDay: true as const };
    if (item.type === 'booking') {
      events.push({
        ...base,
        kind: 'booking',
        status: item.status ?? '',
        guestName: trimmed(item.guestName) ?? '',
        otaReviewReason: item.status === 'Cancelled' ? null : (item.otaReviewReason ?? null),
      });
    } else {
      events.push({
        ...base,
        kind: 'block',
        channel: toChannel(item.channel),
        feedLabel: trimmed(item.feedLabel),
        summary: trimmed(item.summary),
        manual: item.blockSource === 'Manual',
        reason: toReason(item.blockSource === 'Manual', item.blockReason),
        stayId: item.bookingId ?? null,
        convertible: item.convertible === true,
      });
    }
  }
  return events;
}

/**
 * A block of the Timeline (`GET /api/calendar`: a portal's reservation, `Ical`, or the host's own, `Block`) as the event that the
 * block panel and its actions already know: one panel and one set of actions, whichever calendar the click came from.
 */
export function toHostCalendarBlockEvent(item: HostCalendarIcalItem | HostCalendarBlockItem): HostCalendarBlockEvent {
  const base = {
    id: item.id,
    arrival: item.from,
    departure: item.to,
    nights: nightsBetween(item.from, item.to),
    start: stayDateToLocalDate(item.from) ?? new Date(Number.NaN),
    end: stayDateToLocalDate(item.to) ?? new Date(Number.NaN),
    allDay: true as const,
  };
  if (item.type === 'Block') {
    return {
      ...base,
      kind: 'block',
      channel: null,
      feedLabel: null,
      summary: trimmed(item.note),
      manual: true,
      reason: toReason(true, item.reason),
      stayId: null,
      convertible: false,
    };
  }
  return {
    ...base,
    kind: 'block',
    channel: toChannel(item.channel),
    feedLabel: trimmed(item.feedLabel),
    summary: trimmed(item.note),
    manual: false,
    reason: null,
    stayId: item.bookingId ?? null,
    convertible: item.convertible === true,
  };
}

/**
 * Where the dates of a block come from: for a block entered by the host its reason ("Soggiorno del proprietario"),
 * otherwise the label of the feed, else its channel, else a generic label.
 */
export function blockSourceLabel(event: HostCalendarBlockEvent, t: TFunction): string {
  if (event.manual && event.reason === MODE_CHANGE_BLOCK_REASON) return t('propertyMode.calendar.blockReason');
  if (event.manual) return t(`booking.calendar.manualBlock.reasons.${event.reason ?? 'Other'}`);
  if (event.feedLabel) return event.feedLabel;
  if (event.channel) return t(`ical.channels.${event.channel}`);
  return t('booking.calendar.block.otherSource');
}
