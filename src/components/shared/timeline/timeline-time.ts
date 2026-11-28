import { formatRomeDateTime, nightsBetween, romeDateOf, todayInRome } from '@/lib/stay-dates';

const MS_PER_MINUTE = 60_000;
const MS_PER_HOUR = 3_600_000;
const MS_PER_DAY = 86_400_000;
const LAST_RELATIVE_DAY = 6;

const daysBetween = (from: string, to: string): number => nightsBetween(from, to) - nightsBetween(to, from);

const relativeFormats = new Map<string, Intl.RelativeTimeFormat>();

function relativeFormat(locale: string): Intl.RelativeTimeFormat {
  let format = relativeFormats.get(locale);
  if (!format) {
    format = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
    relativeFormats.set(locale, format);
  }
  return format;
}

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

export function formatRelative(at: Date, now: Date, locale: string): string | null {
  const difference = at.getTime() - now.getTime();
  const distance = Math.abs(difference);
  if (distance >= MS_PER_DAY) {
    const days = daysBetween(todayInRome(now), romeDateOf(at.toISOString()));
    return Math.abs(days) <= LAST_RELATIVE_DAY ? relativeFormat(locale).format(days, 'day') : null;
  }
  const format = relativeFormat(locale);
  if (distance < MS_PER_MINUTE) return format.format(0, 'second');
  if (distance < MS_PER_HOUR) return format.format(Math.trunc(difference / MS_PER_MINUTE), 'minute');
  return format.format(Math.trunc(difference / MS_PER_HOUR), 'hour');
}
