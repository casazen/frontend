import { addDays, romeWallTimeToUtc, todayInRome } from '@/lib/stay-dates';
import { ALERT_TYPES, type AlertType, type AlertUrgency, type PendingAlert } from '@/types/alert';

const URGENCY_RANK: Record<AlertUrgency, number> = { High: 3, Normal: 2, Low: 1 };

export function orderAlerts(alerts: readonly PendingAlert[]): PendingAlert[] {
  return [...alerts].sort((a, b) => URGENCY_RANK[b.urgency] - URGENCY_RANK[a.urgency]);
}

export function upsertAlert(alerts: readonly PendingAlert[], alert: PendingAlert): PendingAlert[] {
  const index = alerts.findIndex((item) => item.alertId === alert.alertId);
  if (index === -1) return [...alerts, alert];
  const next = [...alerts];
  next[index] = alert;
  return next;
}

export function alertRoute(alert: Pick<PendingAlert, 'entityType' | 'entityId'>): string | null {
  const id = encodeURIComponent(alert.entityId);
  switch (alert.entityType.toLowerCase()) {
    case 'booking':
      return `/app/short-rent/bookings/${id}`;
    case 'property':
      return `/app/short-rent/properties/${id}`;
    default:
      return null;
  }
}

function isKnownAlertType(alertType: string): alertType is AlertType {
  return (ALERT_TYPES as readonly string[]).includes(alertType);
}

export function alertTypeKey(alertType: string): string {
  return `alert.popup.type.${isKnownAlertType(alertType) ? alertType : 'generic'}`;
}

export const REMIND_CHOICES = ['15min', '1hour', '4hours', 'tomorrow'] as const;

type RemindChoice = (typeof REMIND_CHOICES)[number];

const MINUTE_MS = 60_000;
const REMIND_AFTER_MS: Record<Exclude<RemindChoice, 'tomorrow'>, number> = {
  '15min': 15 * MINUTE_MS,
  '1hour': 60 * MINUTE_MS,
  '4hours': 4 * 60 * MINUTE_MS,
};

export function remindAtFor(choice: RemindChoice, now: Date): Date | null {
  if (choice !== 'tomorrow') return new Date(now.getTime() + REMIND_AFTER_MS[choice]);
  const nineInRome = romeWallTimeToUtc(addDays(todayInRome(now), 1), '09:00');
  return nineInRome ? new Date(nineInRome) : null;
}

export function remindOptions(now: Date, deadline?: Date): Array<{ choice: RemindChoice; disabled: boolean }> {
  return REMIND_CHOICES.flatMap((choice) => {
    const remindAt = remindAtFor(choice, now);
    return remindAt ? [{ choice, disabled: deadline !== undefined && remindAt.getTime() > deadline.getTime() }] : [];
  });
}
