import type { TFunction } from 'i18next';
import type { RoutineEventConfig, RoutineEventType } from '@/types';
import { eventLabelKey, TIME_EVENT_TYPES } from './routine-model';

export function routineTrigger(t: TFunction, event: RoutineEventType, timing?: RoutineEventConfig): string {
  if (!TIME_EVENT_TYPES.includes(event)) return t(eventLabelKey(event));
  const totalHours = (timing?.days ?? 0) * 24 + (timing?.hours ?? 0);
  if (!totalHours) return t(event.endsWith('Checkin') ? 'routines.flow.atCheckin' : 'routines.flow.atCheckout');
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  const delay = [
    days > 0 && t('routines.library.daysCount', { count: days }),
    hours > 0 && t('routines.library.hoursCount', { count: hours }),
  ].filter(Boolean).join(' ');
  return t(`routines.flow.timing.${event}`, { delay });
}
