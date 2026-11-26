import type { TFunction } from 'i18next';
import { formatRomeDateTime } from '@/lib/stay-dates';
import type { SwissNotificationDay } from '@/types/swissCompliance.types';
import { dayStateOf, isFutureDay } from './swiss-day-model';

/**
 * An instant as the host reads it in the layer («19 novembre, 15:20»): in the time of the deadlines of the stays. Switzerland and Italy share their clock (the same offset and the same days
 * for the summer time), so a deadline of a canton reads the same in either.
 */
function whenOf(instant: string, locale: string, options?: Intl.DateTimeFormatOptions): string {
  return formatRomeDateTime(instant, locale, options);
}

/**
 * What says a day is closed: who declared it notified and when («Già notificato il 19 novembre, 15:20 da Mario Rossi.»). `null` for a day that is still to notify (or has no
 * arrival): nothing is closed.
 */
export function closedLineOf(day: Pick<SwissNotificationDay, 'stayCount' | 'alreadyDeclared' | 'declaredAt' | 'declaredBy'>, t: TFunction, locale: string): string | null {
  if (dayStateOf(day) !== 'declared') return null;
  const when = day.declaredAt ? whenOf(day.declaredAt, locale) : '';
  if (when === '') return t('swissNotification.day.declaredBare');
  return day.declaredBy ? t('swissNotification.day.declared', { when, who: day.declaredBy }) : t('swissNotification.day.declaredAnonymous', { when });
}

/** The deadline of a day when the canton has one the screen can read; `null` where it has none (a deadline is never made up: the screen says it is not known). */
function dueTimeOf(day: Pick<SwissNotificationDay, 'dueAt'>): number | null {
  const time = day.dueAt ? new Date(day.dueAt).getTime() : Number.NaN;
  return Number.isNaN(time) ? null : time;
}

/**
 * The line under the title of the day: that it is closed and by whom, that nobody arrives, that the day has not started, or by when it is due: «Da notificare entro venerdì 20
 * novembre, 15:00», «La scadenza è passata», and, where the canton gives none, «Scadenza non nota». `asOf` is when the day was read: a render never reads the clock by itself.
 */
export function stateLineOf(day: SwissNotificationDay, t: TFunction, locale: string, asOf: number): string {
  const closed = closedLineOf(day, t, locale);
  if (closed) return closed;
  if (dayStateOf(day) === 'none') return t('swissNotification.day.none');
  if (isFutureDay(day, new Date(asOf))) return t('swissNotification.day.future');

  const due = dueTimeOf(day);
  if (due === null || !day.dueAt) return t('swissNotification.day.noDeadline');
  const when = whenOf(day.dueAt, locale, { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
  return t(due < asOf ? 'swissNotification.day.overdue' : 'swissNotification.day.due', { when });
}
