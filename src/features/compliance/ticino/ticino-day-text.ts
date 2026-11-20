import type { TFunction } from 'i18next';
import { formatRomeDateTime } from '@/lib/stay-dates';
import type { TicinoNotificationDay } from '@/types/swissCompliance.types';
import { dayStateOf } from './ticino-day-model';

/**
 * An instant as the host reads it in the layer («19 novembre, 15:20»): in the time of the deadlines of the stays. Switzerland and Italy share their clock (the same offset
 * and the same days for the summer time), so the deadline of the notification, counted in Zurich, reads the same.
 */
export function whenText(instant: string, locale: string): string {
  return formatRomeDateTime(instant, locale);
}

/**
 * What says a day is closed: who uploaded it to the portal and when («Già caricato il 19 novembre, 15:20 da Mario Rossi.»), or that the receipt of the portal is
 * archived. `null` for a day that is still to notify (or has no arrival): nothing is closed.
 */
export function closedLineOf(day: TicinoNotificationDay, t: TFunction, locale: string): string | null {
  const state = dayStateOf(day);
  if (state === 'declared') {
    const when = whenText(day.declaredAt ?? '', locale);
    return day.declaredBy ? t('swiss.day.declared', { when, who: day.declaredBy }) : t('swiss.day.declaredAnonymous', { when });
  }
  return state === 'receipt' ? t('swiss.day.closedByReceipt') : null;
}
