import type { TFunction } from 'i18next';
import { formatRomeDateTime } from '@/lib/stay-dates';
import type { TicinoNotificationDay } from '@/types/swissCompliance.types';
import { dayStateOf } from './ticino-day-model';

export function whenText(instant: string, locale: string): string {
  return formatRomeDateTime(instant, locale);
}

export function closedLineOf(day: TicinoNotificationDay, t: TFunction, locale: string): string | null {
  const state = dayStateOf(day);
  if (state === 'declared') {
    const when = whenText(day.declaredAt ?? '', locale);
    return day.declaredBy ? t('swiss.day.declared', { when, who: day.declaredBy }) : t('swiss.day.declaredAnonymous', { when });
  }
  return state === 'receipt' ? t('swiss.day.closedByReceipt') : null;
}
