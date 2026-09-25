import { addDays, endOfMonth, nightsBetween, parseStayDate, startOfMonth, startOfWeek, stayDateToLocalDate } from '@/lib/stay-dates';
import type { TFunction } from 'i18next';
import type { CalendarItemDto } from '@/types/calendar.types';

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
}

export type HostCalendarEvent = HostCalendarBookingEvent | HostCalendarBlockEvent;

function toChannel(value: string | null | undefined): HostCalendarChannel | null {
  return HOST_CALENDAR_CHANNELS.find((channel) => channel === value) ?? null;
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
      events.push({ ...base, kind: 'booking', status: item.status ?? '', guestName: trimmed(item.guestName) ?? '' });
    } else {
      events.push({
        ...base,
        kind: 'block',
        channel: toChannel(item.channel),
        feedLabel: trimmed(item.feedLabel),
        summary: trimmed(item.summary),
      });
    }
  }
  return events;
}

/** Where the dates of a block come from: the label of the feed, else its channel, else a generic label. */
export function blockSourceLabel(event: HostCalendarBlockEvent, t: TFunction): string {
  if (event.feedLabel) return event.feedLabel;
  if (event.channel) return t(`ical.channels.${event.channel}`);
  return t('booking.calendar.block.otherSource');
}
