import { formatRomeDateTime, formatStayDate, romeDateOf, todayInRome } from '@/lib/stay-dates';

/*
 * The time of a message is shown in Europe/Rome, like every deadline and every stay of the product: the API sends UTC instants and Rome
 * dates, and a property carries no time zone of its own.
 */

const HOUR: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' };
const DAY: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
const DAY_AND_HOUR: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' };

/** The time of the last message in a list: the hour for a message of today, the day for any other. */
export function formatListTime(instant: string, locale: string, now: Date): string {
  return formatRomeDateTime(instant, locale, romeDateOf(instant) === todayInRome(now) ? HOUR : DAY);
}

/** The time of a message in a conversation: the day and the hour. */
export function formatMessageTime(instant: string, locale: string): string {
  return formatRomeDateTime(instant, locale, DAY_AND_HOUR);
}

/** «12–15 ott»: the days of a stay; empty when one of the two is missing. */
export function formatStayRange(checkIn: string | null | undefined, checkOut: string | null | undefined, locale: string): string {
  if (!checkIn || !checkOut) return '';
  return `${formatStayDate(checkIn, locale, DAY)}–${formatStayDate(checkOut, locale, DAY)}`;
}
