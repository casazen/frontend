import { formatRomeDateTime, nightsBetween, romeDateOf, todayInRome } from '@/lib/stay-dates';

const MS_PER_MINUTE = 60_000;
const MS_PER_HOUR = 3_600_000;
const MS_PER_DAY = 86_400_000;
/** Beyond this many calendar days the date alone says it: "3 months ago" tells less than "12 Jul". */
const LAST_RELATIVE_DAY = 6;

/** Calendar days from `from` to `to` (`YYYY-MM-DD` both), negative when `to` is earlier. `nightsBetween` counts forward only. */
const daysBetween = (from: string, to: string): number => nightsBetween(from, to) - nightsBetween(to, from);

const relativeFormats = new Map<string, Intl.RelativeTimeFormat>();

/** One formatter for each language, made when it is first needed: a timeline asks for one per event, and again every minute. */
function relativeFormat(locale: string): Intl.RelativeTimeFormat {
  let format = relativeFormats.get(locale);
  if (!format) {
    format = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
    relativeFormats.set(locale, format);
  }
  return format;
}

/**
 * The instant as a date and a time in Rome (the time of the place it happens in, whatever the time zone of the browser, as the
 * stay dates are), with the year only when it is not this year's: "16 ott, 11:30". 24-hour clock in both languages.
 */
export function formatAbsolute(at: Date, now: Date, locale: string): string {
  const instant = at.toISOString();
  const sameYear = romeDateOf(instant).slice(0, 4) === todayInRome(now).slice(0, 4);
  return formatRomeDateTime(instant, locale, {
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
}

/**
 * How long ago (or how far ahead) the instant is, in words: "3 minuti fa", "ieri", "tra 2 giorni". Within a day it counts
 * the time that passed; beyond that it counts the calendar days of Rome, so 23:30 yesterday is "yesterday" at 00:10. Past
 * a week there is no relative form (null): the date says it.
 */
export function formatRelative(at: Date, now: Date, locale: string): string | null {
  const difference = at.getTime() - now.getTime();
  const distance = Math.abs(difference);
  if (distance >= MS_PER_DAY) {
    const days = daysBetween(todayInRome(now), romeDateOf(at.toISOString()));
    return Math.abs(days) <= LAST_RELATIVE_DAY ? relativeFormat(locale).format(days, 'day') : null;
  }
  const format = relativeFormat(locale);
  if (distance < MS_PER_MINUTE) return format.format(0, 'second');
  // Whole units, toward zero: 59 and a half minutes ago is "59 minutes ago", not "60".
  if (distance < MS_PER_HOUR) return format.format(Math.trunc(difference / MS_PER_MINUTE), 'minute');
  return format.format(Math.trunc(difference / MS_PER_HOUR), 'hour');
}
