import { parseStayDate, romeDateOf } from '@/lib/stay-dates';

/** A zone at the end of a date with a time: `Z`, `+02:00`, `-0500`. */
const ZONE = /T[\d:.]+(?:Z|[+-]\d{2}(?::?\d{2})?)$/i;

/**
 * The calendar day (`YYYY-MM-DD`) of what a page gives as the day of something, whichever way it writes it:
 *  - `2026-10-16`, or `2026-10-16T09:30:00` (no zone: the date field of a stay in the API, a time on the day of the stay) is
 *    the day it says;
 *  - `2026-10-16T22:30:00Z`, or with an offset, is an instant: the day it falls on in Europe/Rome (`2026-10-17`), not the day
 *    of the UTC date (`2026-10-17T00:00:00Z`, the stored midnight of a day, falls on that same day in Rome).
 * An empty string when it is none of these.
 */
export function calendarDayOf(value: string | null | undefined): string {
  if (!value) return '';
  return ZONE.test(value) ? romeDateOf(value) : parseStayDate(value);
}
