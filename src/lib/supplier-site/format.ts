import type { TFunction } from 'i18next';
import { addDays, formatStayDate, romeWallClock, todayInRome } from '@/lib/stay-dates';

const pad = (value: number) => String(value).padStart(2, '0');

/**
 * A free slot as a person says it: "oggi alle 14:00", "domani alle 09:30", "giovedì 9 ottobre alle 14:00". The day and the
 * clock are those of Rome (the supplier works there), whatever the time zone of the browser; an instant that is not a date
 * gives an empty string.
 */
export function formatSlotLabel(startUtc: string, t: TFunction, locale: string): string {
  const clock = romeWallClock(startUtc);
  if (!clock) return '';
  const time = `${pad(clock.hour)}:${pad(clock.minute)}`;
  const today = todayInRome();
  if (clock.date === today) return t('supplierSite.slot.today', { time });
  if (clock.date === addDays(today, 1)) return t('supplierSite.slot.tomorrow', { time });
  const day = formatStayDate(clock.date, locale, { weekday: 'long', day: 'numeric', month: 'long' });
  return t('supplierSite.slot.day', { day, time });
}

/** The time the supplier has to answer a booking (its setting), in words and exact: "45 minuti", "3 ore". */
export function formatDeadline(minutes: number, t: TFunction): string {
  if (minutes < 90) return t('supplierSite.deadline.minutes', { count: minutes });
  return t('supplierSite.deadline.hours', { count: Math.round(minutes / 60) });
}

/** The typical time to answer in words: "circa 45 minuti", "circa 2 ore". Rounded, because it is a median, not a promise. */
export function formatTypicalResponse(minutes: number, t: TFunction): string {
  if (minutes < 90) {
    const rounded = Math.max(5, Math.round(minutes / 5) * 5);
    return t('supplierSite.responseTime.minutes', { count: rounded });
  }
  return t('supplierSite.responseTime.hours', { count: Math.round(minutes / 60) });
}
