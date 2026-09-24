/**
 * Stay dates are calendar dates without a time (`YYYY-MM-DD`). "Today" is the calendar date in
 * Europe/Rome, whatever the time zone of the guest's browser.
 */
const STAY_TIME_ZONE = 'Europe/Rome';
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function toUtcDate(value: string): Date | null {
  const match = DATE_ONLY.exec(value);
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  const sameDay = date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  return sameDay ? date : null;
}

/** True for an existing calendar date written as `YYYY-MM-DD`. */
export function isStayDate(value: string): boolean {
  return toUtcDate(value) !== null;
}

/** Calendar date (`YYYY-MM-DD`) of `now` in Europe/Rome. */
export function todayInRome(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: STAY_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

/** `date` moved by `days` calendar days, or an empty string when `date` is not a stay date. */
export function addDays(date: string, days: number): string {
  const utc = toUtcDate(date);
  if (!utc) return '';
  return new Date(utc.getTime() + days * MS_PER_DAY).toISOString().slice(0, 10);
}

/** Nights between two stay dates; 0 when a date is missing, invalid or not in order. */
export function nightsBetween(checkIn: string, checkOut: string): number {
  const start = toUtcDate(checkIn);
  const end = toUtcDate(checkOut);
  if (!start || !end) return 0;
  const nights = Math.round((end.getTime() - start.getTime()) / MS_PER_DAY);
  return nights > 0 ? nights : 0;
}

/**
 * A UTC instant (ISO string, e.g. a deadline) shown as date and time in Europe/Rome, the time zone of every deadline
 * of the stays; an empty string when invalid.
 */
export function formatRomeDateTime(instant: string, locale: string): string {
  const date = new Date(instant);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: STAY_TIME_ZONE,
  }).format(date);
}

/** Stay date formatted for display (no time zone shift), or an empty string when invalid. */
export function formatStayDate(
  date: string,
  locale: string,
  options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' },
): string {
  const utc = toUtcDate(date);
  return utc ? new Intl.DateTimeFormat(locale, { ...options, timeZone: 'UTC' }).format(utc) : '';
}
