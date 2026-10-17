import type { TFunction } from 'i18next';
import { getServiceCategoryLabel } from '@/lib/i18n-labels';
import { addDays, formatRomeDateTime, formatStayDate, isStayDate, nightsBetween } from '@/lib/stay-dates';
import type {
  HostCalendarItem,
  HostCalendarItemChannel,
  HostCalendarProperty,
  HostCalendarQuery,
  HostCalendarResponse,
  HostCalendarServiceItem,
  HostCalendarStayItem,
} from '@/types/host-calendar.types';
import type { CalendarKind } from './calendar-kinds';
import { HOST_CALENDAR_VIEWS, blockSourceLabel, toHostCalendarBlockEvent } from './host-calendar';

/**
 * The Timeline of the host calendar (SR-02): every property is a row, every day a column, a stay is a bar and an intervention a
 * mark on its day. Everything here is plain arithmetic on calendar dates (`yyyy-MM-dd`), with no clock and no DOM: the dates
 * come from the API as written and are never turned into instants, so no time zone moves them.
 */

/** The ways the calendar page shows the host's stays: the Timeline of every property, or the month, the week or the day of one. */
export const CALENDAR_PAGE_VIEWS = ['timeline', ...HOST_CALENDAR_VIEWS] as const;
export type CalendarPageView = (typeof CALENDAR_PAGE_VIEWS)[number];

/** How many days the Timeline shows at once. */
export const TIMELINE_ZOOMS = [7, 14, 30] as const;
export type TimelineZoom = (typeof TIMELINE_ZOOMS)[number];

const DEFAULT_ZOOM: TimelineZoom = 14;

/** The Timeline starts two days before the day it is around, so that what has just happened is on the left of what comes. */
const LEAD_DAYS = 2;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * The view the address asks for (`?view=`). Without one, a screen with room (a tablet or a computer) opens the Timeline and a
 * phone the month of one property: the Timeline there is a strip that scrolls sideways, one tap away.
 */
export function parseCalendarView(value: string | null, wideScreen: boolean): CalendarPageView {
  const asked = CALENDAR_PAGE_VIEWS.find((view) => view === value);
  return asked ?? (wideScreen ? 'timeline' : 'month');
}

/** The number of days the address asks for (`?zoom=`): 7, 14 or 30; anything else is 14. */
export function parseTimelineZoom(value: string | null): TimelineZoom {
  const asked = Number(value);
  return TIMELINE_ZOOMS.find((zoom) => zoom === asked) ?? DEFAULT_ZOOM;
}

/**
 * The day the calendar is around: the first day of the Timeline, or the day the month, the week or the day is around. The
 * address holds it as `?from=`; without one it is today (two days earlier in the Timeline).
 */
export function resolveCalendarAnchor(from: string | null, view: CalendarPageView, today: string): string {
  if (from && isStayDate(from)) return from;
  return view === 'timeline' ? addDays(today, -LEAD_DAYS) : today;
}

/** The days of the Timeline, the first one included. */
export function timelineDays(start: string, zoom: number): string[] {
  return Array.from({ length: zoom }, (_, index) => addDays(start, index));
}

/**
 * The read the Timeline makes for a window: its days, both ends included, and one property when the address asks for one. The page
 * and the drawers it opens build it with this, so that they share one entry of the cache and never read the days twice.
 */
export function timelineQuery(start: string, zoom: number, propertyId: string): HostCalendarQuery {
  const days = { from: start, to: addDays(start, zoom - 1) };
  return propertyId ? { ...days, propertyId } : days;
}

/** How far the arrows move the Timeline: a week, and half a window when it shows a month. */
function timelineStep(zoom: number): number {
  return zoom >= 30 ? 15 : 7;
}

/** The first day of the Timeline after the arrows: back (`-1`) or forward (`1`). */
export function shiftTimelineStart(start: string, zoom: number, direction: -1 | 1): string {
  return addDays(start, direction * timelineStep(zoom));
}

/** What the toolbar says the Timeline is showing: "5–18 ottobre 2026", "28 set – 11 ott 2026". */
export function timelineLabel(start: string, zoom: number, language: string): string {
  const end = addDays(start, zoom - 1);
  const sameYear = start.slice(0, 4) === end.slice(0, 4);
  if (sameYear && start.slice(0, 7) === end.slice(0, 7)) {
    return `${formatStayDate(start, language, { day: 'numeric' })}–${formatStayDate(end, language, { day: 'numeric', month: 'long', year: 'numeric' })}`;
  }
  const from = formatStayDate(start, language, sameYear ? { day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short', year: 'numeric' });
  return `${from} – ${formatStayDate(end, language, { day: 'numeric', month: 'short', year: 'numeric' })}`;
}

/** Saturday and Sunday: the columns of the weekend are tinted. */
export function isWeekendDay(day: string): boolean {
  const weekday = new Date(`${day}T00:00:00Z`).getUTCDay();
  return weekday === 0 || weekday === 6;
}

function dayNumber(day: string): number {
  const [year, month, date] = day.split('-').map(Number);
  return Date.UTC(year, month - 1, date) / MS_PER_DAY;
}

/** Days from `from` to `to` (negative when `to` is earlier); both must be calendar dates. */
function daysBetween(from: string, to: string): number {
  return Math.round(dayNumber(to) - dayNumber(from));
}

/* ------------------------------------------------------------------------------------------------------------- Geometry */

/** Where the nights of an item fall in the window: the column it starts in, how many columns, and whether the window cuts it. */
export interface DaySpan {
  index: number;
  length: number;
  clippedStart: boolean;
  clippedEnd: boolean;
}

/** The columns of the nights `from` to `to` (departure day, not a night) in the window of `zoom` days from `start`; null when none falls in it. */
function spanInWindow(from: string, to: string, start: string, zoom: number): DaySpan | null {
  const first = daysBetween(start, from);
  const after = daysBetween(start, to);
  const index = Math.max(0, first);
  const end = Math.min(zoom, after);
  if (end <= index) return null;
  return { index, length: end - index, clippedStart: first < 0, clippedEnd: after > zoom };
}

/**
 * Lanes: two stays that overlap (a night taken twice) go on two rows of the property, so that no bar covers another. The one that
 * starts first, and then the longer one, takes the first lane that is free.
 */
function assignLanes(items: readonly HostCalendarStayItem[]): { lanes: Map<string, number>; count: number } {
  const sorted = [...items].sort((a, b) => a.from.localeCompare(b.from) || b.to.localeCompare(a.to) || a.id.localeCompare(b.id));
  const ends: string[] = []; // the day each lane is free from
  const lanes = new Map<string, number>();
  for (const item of sorted) {
    let lane = ends.findIndex((end) => end <= item.from);
    if (lane < 0) {
      lane = ends.length;
      ends.push(item.to);
    } else {
      ends[lane] = item.to;
    }
    lanes.set(item.id, lane);
  }
  return { lanes, count: Math.max(1, ends.length) };
}

/**
 * The stays and blocks of a property that share a night with another one, from today on (the same rule as the server's, which puts
 * the first of them among the things to do of the Home): the departure day is free for an arrival. Only nights inside the window
 * count, as for the server's alerts of the same range.
 */
function conflictingIds(items: readonly HostCalendarStayItem[], today: string, windowStart: string, windowEnd: string): Set<string> {
  const ids = new Set<string>();
  const sorted = [...items].sort((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to) || a.id.localeCompare(b.id));
  for (let i = 0; i < sorted.length; i += 1) {
    const a = sorted[i];
    for (let j = i + 1; j < sorted.length; j += 1) {
      const b = sorted[j];
      // In order of arrival: from here on nothing starts before `a` leaves.
      if (b.from >= a.to) break;
      const sharedTo = a.to < b.to ? a.to : b.to;
      if (sharedTo <= b.from || sharedTo <= today || b.from > windowEnd || sharedTo <= windowStart) continue;
      ids.add(a.id);
      ids.add(b.id);
    }
  }
  return ids;
}

/* ------------------------------------------------------------------------------------------------------------------ Rows */

export interface TimelineBar {
  item: HostCalendarStayItem;
  span: DaySpan;
  lane: number;
  kind: CalendarKind;
  /** It shares a night with another stay or block of the property. */
  conflict: boolean;
}

/** An intervention: a mark on the day of the work; several on one day sit one under the other (`slot`). */
export interface TimelineChip {
  item: HostCalendarServiceItem;
  index: number;
  slot: number;
}

export interface TimelineRow {
  property: HostCalendarProperty;
  bars: TimelineBar[];
  /** How many rows of bars the property needs (at least one). */
  lanes: number;
  chips: TimelineChip[];
  /** How many marks the busiest day of the property has (0: no marks, no room for them). */
  slots: number;
}

const isStay = (item: HostCalendarItem): item is HostCalendarStayItem => item.type === 'Booking' || item.type === 'Ical' || item.type === 'Block';
const isService = (item: HostCalendarItem): item is HostCalendarServiceItem => item.type === 'Service';

/** A stay or a block with days that make sense: arrival before departure. An item the app does not understand is left out. */
const isDrawable = (item: HostCalendarItem): boolean => isStayDate(item.from) && isStayDate(item.to) && (isService(item) ? item.to >= item.from : item.to > item.from);

/**
 * How a stay or a block is drawn: by its state (a booking), by where it comes from (a portal) or as closed by the host. A pending
 * stay of the booking site that is not a request to answer is a checkout where the guest is paying right now (dotted edge); any
 * other pending stay (one the host entered and has yet to confirm) and a "pay at the property" request wait for the host (dashed).
 */
export function stayKindOf(item: HostCalendarStayItem): CalendarKind {
  switch (item.type) {
    case 'Ical':
      return 'block';
    case 'Block':
      return 'manualBlock';
    default:
      if (item.otaReviewReason) return 'toReview';
      if (item.status === 'Pending') return item.channel === 'Direct' && !item.onSiteRequestState ? 'PendingPayment' : 'Pending';
      return item.status === 'CheckedIn' || item.status === 'CheckedOut' ? item.status : 'Confirmed';
  }
}

/** The rows of the Timeline: the properties as the API lists them, each with its bars on lanes and its marks on their days. */
export function buildTimelineRows(calendar: HostCalendarResponse, start: string, zoom: number, today: string): TimelineRow[] {
  const windowEnd = addDays(start, zoom - 1);
  const byProperty = new Map<string, HostCalendarItem[]>();
  for (const item of calendar.items) {
    if (!isDrawable(item)) continue;
    const list = byProperty.get(item.propertyId);
    if (list) list.push(item);
    else byProperty.set(item.propertyId, [item]);
  }

  return calendar.properties.map((property) => {
    const items = byProperty.get(property.id) ?? [];
    const stays = items.filter(isStay);
    const inWindow = stays.filter((item) => spanInWindow(item.from, item.to, start, zoom) !== null);
    const { lanes, count } = assignLanes(inWindow);
    const conflicts = conflictingIds(stays, today, start, windowEnd);
    const bars = inWindow.map((item): TimelineBar => ({
      item,
      span: spanInWindow(item.from, item.to, start, zoom)!,
      lane: lanes.get(item.id) ?? 0,
      kind: stayKindOf(item),
      conflict: conflicts.has(item.id),
    }));

    const perDay = new Map<number, number>();
    const chips: TimelineChip[] = [];
    for (const service of items.filter(isService)) {
      const index = daysBetween(start, service.from);
      if (index < 0 || index >= zoom) continue;
      const slot = perDay.get(index) ?? 0;
      perDay.set(index, slot + 1);
      chips.push({ item: service, index, slot });
    }
    return { property, bars, lanes: count, chips, slots: perDay.size > 0 ? Math.max(...perDay.values()) : 0 };
  });
}

/** The kind of drawer an item opens (`useDetailDrawer`): the booking has its own, the others are registered in `config/detail-kinds`. */
export function drawerKindOf(item: HostCalendarItem): 'booking' | 'ical' | 'block' | 'intervention' {
  switch (item.type) {
    case 'Booking':
      return 'booking';
    case 'Ical':
      return 'ical';
    case 'Block':
      return 'block';
    default:
      return 'intervention';
  }
}

/* ----------------------------------------------------------------------------------------------------------------- Words */

/** Where a stay came from, in words: the booking site, by hand, a portal. */
export function channelLabel(channel: HostCalendarItemChannel | undefined, t: TFunction): string {
  switch (channel) {
    case 'Direct':
      return t('booking.source.Direct');
    case 'Manual':
      return t('booking.source.Manual');
    case 'Airbnb':
      return t('ical.channels.Airbnb');
    case 'BookingCom':
      return t('ical.channels.BookingCom');
    case 'Other':
      return t('ical.channels.Other');
    default:
      return '';
  }
}

/** Who the stay is of, or where the block comes from: what the bar says. */
export function stayItemTitle(item: HostCalendarStayItem, t: TFunction): string {
  if (item.type === 'Booking') return item.guestName?.trim() || t('booking.calendar.guestUnknown');
  return blockSourceLabel(toHostCalendarBlockEvent(item), t);
}

/** What an intervention is: the service as the supplier named it, else its category. */
export function serviceItemTitle(item: HostCalendarServiceItem, t: TFunction): string {
  return item.serviceName?.trim() || getServiceCategoryLabel(item.category ?? '', t) || t('booking.calendar.legend.service');
}

/** "10:00–12:00" (Europe/Rome) when the intervention has a time, else an empty string. */
export function serviceTimeText(item: HostCalendarServiceItem, language: string): string {
  const clock = (instant: string | undefined) => (instant ? formatRomeDateTime(instant, language, { hour: '2-digit', minute: '2-digit' }) : '');
  const from = clock(item.startAt);
  const to = clock(item.endAt);
  return from && to ? `${from}–${to}` : from;
}

/** "dal 7 ottobre al 10 ottobre, 3 notti": the nights of a stay or a block in a sentence a screen reader reads well. */
export function itemRangeText(item: HostCalendarStayItem, t: TFunction, language: string): string {
  const day = (value: string) => formatStayDate(value, language, { day: 'numeric', month: 'long' });
  return t('booking.calendar.timeline.range', { arrival: day(item.from), departure: day(item.to), count: nightsBetween(item.from, item.to) });
}
