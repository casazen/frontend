import { romeDateOf, todayInRome } from '@/lib/stay-dates';

/** What happens is told in the time of the place it happens in, whatever the time zone of the browser (as the stay dates are). */
const TIME_ZONE = 'Europe/Rome';
const MS_PER_MINUTE = 60_000;
const MS_PER_HOUR = 3_600_000;
const MS_PER_DAY = 86_400_000;
/** Beyond this many calendar days the date alone says it: "3 months ago" tells less than "12 Jul". */
const LAST_RELATIVE_DAY = 6;

/** Calendar days from `from` to `to` (`YYYY-MM-DD` both), negative when `to` is earlier. */
function daysBetween(from: string, to: string): number {
  const parse = (value: string) => {
    const [year, month, day] = value.split('-').map(Number);
    return Date.UTC(year, month - 1, day);
  };
  return Math.round((parse(to) - parse(from)) / MS_PER_DAY);
}

/** The instant as a date and a time in Rome, with the year only when it is not this year's: "16 ott, 11:30". 24-hour clock in both languages. */
export function formatAbsolute(at: Date, now: Date, locale: string): string {
  const sameYear = romeDateOf(at.toISOString()).slice(0, 4) === todayInRome(now).slice(0, 4);
  return new Intl.DateTimeFormat(locale, {
    timeZone: TIME_ZONE,
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(at);
}

/**
 * How long ago (or how far ahead) the instant is, in words: "3 minuti fa", "ieri", "tra 2 giorni". Within a day it counts
 * the time that passed; beyond that it counts the calendar days of Rome, so 23:30 yesterday is "yesterday" at 00:10. Past
 * a week there is no relative form (null): the date says it.
 */
export function formatRelative(at: Date, now: Date, locale: string): string | null {
  const format = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  const difference = at.getTime() - now.getTime();
  const distance = Math.abs(difference);
  if (distance < MS_PER_MINUTE) return format.format(0, 'second');
  // Whole units, toward zero: 59 and a half minutes ago is "59 minutes ago", not "60".
  if (distance < MS_PER_HOUR) return format.format(Math.trunc(difference / MS_PER_MINUTE), 'minute');
  if (distance < MS_PER_DAY) return format.format(Math.trunc(difference / MS_PER_HOUR), 'hour');
  const days = daysBetween(todayInRome(now), romeDateOf(at.toISOString()));
  return Math.abs(days) <= LAST_RELATIVE_DAY ? format.format(days, 'day') : null;
}
