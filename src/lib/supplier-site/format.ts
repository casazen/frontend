import type { TFunction } from 'i18next';
import { addDays, formatStayDate, romeWallClock, todayInRome } from '@/lib/stay-dates';

const pad = (value: number) => String(value).padStart(2, '0');

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

export function formatSlotRange(startUtc: string, endUtc: string, t: TFunction, locale: string): string {
  const start = formatSlotLabel(startUtc, t, locale);
  const startClock = romeWallClock(startUtc);
  const endClock = romeWallClock(endUtc);
  if (!start || !endClock) return start;
  if (startClock?.date === endClock.date) return `${start}–${pad(endClock.hour)}:${pad(endClock.minute)}`;
  return `${start} → ${formatSlotLabel(endUtc, t, locale)}`;
}
