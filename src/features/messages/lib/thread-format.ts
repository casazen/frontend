import { formatRomeDateTime, formatStayDate, romeDateOf, todayInRome } from '@/lib/stay-dates';

const HOUR: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' };
const DAY: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
const DAY_AND_HOUR: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' };

export function formatListTime(instant: string, locale: string, now: Date): string {
  return formatRomeDateTime(instant, locale, romeDateOf(instant) === todayInRome(now) ? HOUR : DAY);
}

export function formatMessageTime(instant: string, locale: string): string {
  return formatRomeDateTime(instant, locale, DAY_AND_HOUR);
}

export function formatStayRange(checkIn: string | null | undefined, checkOut: string | null | undefined, locale: string): string {
  if (!checkIn || !checkOut) return '';
  return `${formatStayDate(checkIn, locale, DAY)}–${formatStayDate(checkOut, locale, DAY)}`;
}
