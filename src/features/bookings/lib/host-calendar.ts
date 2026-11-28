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

export const HOST_CALENDAR_VIEWS = ['month', 'week', 'day'] as const;
export type HostCalendarView = (typeof HOST_CALENDAR_VIEWS)[number];

export const HOST_CALENDAR_WEEK_STARTS_ON = 1;

export function isHostCalendarView(value: string): value is HostCalendarView {
  return (HOST_CALENDAR_VIEWS as readonly string[]).includes(value);
}

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

function addMonths(date: string, months: number): string {
  const first = startOfMonth(date);
  if (!first) return '';
  const [year, month] = first.split('-').map(Number);
  const targetFirst = utcStayDate(new Date(Date.UTC(year, month - 1 + months, 1)));
  const lastDay = Number(endOfMonth(targetFirst).slice(8, 10));
  return addDays(targetFirst, Math.min(Number(date.slice(8, 10)), lastDay) - 1);
}

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

export const HOST_CALENDAR_CHANNELS = ['Airbnb', 'BookingCom', 'Other'] as const;
export type HostCalendarChannel = (typeof HOST_CALENDAR_CHANNELS)[number];

interface HostCalendarEventBase {
  id: string;
  arrival: string;
  departure: string;
  nights: number;
  start: Date;
  end: Date;
  allDay: true;
}

export interface HostCalendarBookingEvent extends HostCalendarEventBase {
  kind: 'booking';
  status: string;
  guestName: string;
  source?: string;
  /** OTA stay created from an iCal block that a sync marked "da verificare" (CO-21); null otherwise. */
  otaReviewReason: OtaReviewReason | null;
}

export interface HostCalendarBlockEvent extends HostCalendarEventBase {
  kind: 'block';
  channel: HostCalendarChannel | null;
  feedLabel: string | null;
  summary: string | null;
  manual: boolean;
  reason: BlockReason | null;
  stayId: string | null;
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
        source: trimmed(item.source) ?? undefined,
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
