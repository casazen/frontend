import type { TFunction } from 'i18next';
import { formatRomeDateTime } from '@/lib/stay-dates';
import type { SwissNotificationDay } from '@/types/swissCompliance.types';
import { dayStateOf, isFutureDay } from './swiss-day-model';

function whenOf(instant: string, locale: string, options?: Intl.DateTimeFormatOptions): string {
  return formatRomeDateTime(instant, locale, options);
}

export function closedLineOf(day: Pick<SwissNotificationDay, 'stayCount' | 'alreadyDeclared' | 'declaredAt' | 'declaredBy'>, t: TFunction, locale: string): string | null {
  if (dayStateOf(day) !== 'declared') return null;
  const when = day.declaredAt ? whenOf(day.declaredAt, locale) : '';
  if (when === '') return t('swissNotification.day.declaredBare');
  return day.declaredBy ? t('swissNotification.day.declared', { when, who: day.declaredBy }) : t('swissNotification.day.declaredAnonymous', { when });
}

function dueTimeOf(day: Pick<SwissNotificationDay, 'dueAt'>): number | null {
  const time = day.dueAt ? new Date(day.dueAt).getTime() : Number.NaN;
  return Number.isNaN(time) ? null : time;
}

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
