import { addDays, formatStayDate, isStayDate, romeDateOf, romeWallClock } from '@/lib/stay-dates';
import type { PendingFreeEvent } from '@/types/supplier';

const DAY_FORMAT: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' };

/** Rome calendar dates (`YYYY-MM-DD`) first and last touched by the next occurrence (the end instant is exclusive). */
function occurrenceDates(event: Pick<PendingFreeEvent, 'nextStartUtc' | 'nextEndUtc'>): { first: string; last: string } | null {
  const first = romeDateOf(event.nextStartUtc);
  if (!isStayDate(first)) return null;
  const end = new Date(event.nextEndUtc);
  const endMs = end.getTime();
  const startMs = new Date(event.nextStartUtc).getTime();
  const last = Number.isNaN(endMs) || endMs <= startMs ? first : romeDateOf(new Date(endMs - 1).toISOString());
  return { first, last: isStayDate(last) && last >= first ? last : first };
}

/** The days (Europe/Rome) held by the next occurrence of the events that wait for an answer. */
export function pendingFreeEventDates(events: readonly PendingFreeEvent[]): Set<string> {
  const dates = new Set<string>();
  for (const event of events) {
    const range = occurrenceDates(event);
    if (!range) continue;
    // A series is bounded by what the page shows; cap the walk so a malformed range cannot spin.
    let date = range.first;
    for (let guard = 0; guard < 400 && date <= range.last; guard += 1) {
      dates.add(date);
      date = addDays(date, 1);
    }
  }
  return dates;
}

function hm(instant: string): string {
  const clock = romeWallClock(instant);
  return clock ? `${String(clock.hour).padStart(2, '0')}:${String(clock.minute).padStart(2, '0')}` : '';
}

/** When the next occurrence happens, on the Europe/Rome clock: `ven 16 ott` / `ven 16 ott – dom 18 ott` for all-day events, with hours otherwise. */
export function describeFreeEventWhen(
  event: Pick<PendingFreeEvent, 'isAllDay' | 'nextStartUtc' | 'nextEndUtc'>,
  locale: string,
): string {
  const range = occurrenceDates(event);
  if (!range) return '';
  const first = formatStayDate(range.first, locale, DAY_FORMAT);
  const last = formatStayDate(range.last, locale, DAY_FORMAT);
  if (event.isAllDay) return range.first === range.last ? first : `${first} – ${last}`;
  const start = hm(event.nextStartUtc);
  const end = hm(event.nextEndUtc);
  if (range.first === range.last) return `${first}, ${start}–${end}`;
  return `${first}, ${start} – ${last}, ${end}`;
}
