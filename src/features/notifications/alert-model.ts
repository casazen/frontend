import { addDays, romeWallTimeToUtc, todayInRome } from '@/lib/stay-dates';
import { ALERT_TYPES, type AlertType, type AlertUrgency, type PendingAlert } from '@/types/alert';

/** Higher is more urgent: the order of the numbers is the order of the queue. */
const URGENCY_RANK: Record<AlertUrgency, number> = { High: 3, Normal: 2, Low: 1 };

/**
 * The queue as the person goes through it: the most urgent alert first. The payload carries no date (ADR-025-R5), so alerts of the
 * same urgency keep the order in which they came in: the server lists them oldest first, and a pushed one comes after them.
 */
export function orderAlerts(alerts: readonly PendingAlert[]): PendingAlert[] {
  return [...alerts].sort((a, b) => URGENCY_RANK[b.urgency] - URGENCY_RANK[a.urgency]);
}

/** The list with `alert` added at the end, or replacing the alert it already has in the list (an alert is in the queue once). */
export function upsertAlert(alerts: readonly PendingAlert[], alert: PendingAlert): PendingAlert[] {
  const index = alerts.findIndex((item) => item.alertId === alert.alertId);
  if (index === -1) return [...alerts, alert];
  const next = [...alerts];
  next[index] = alert;
  return next;
}

/**
 * Where «Fallo ora» goes: the booking or the property the alert is about (the paths of `ROUTE_MANIFEST`). `null` for any other kind
 * of entity: the app has no page to send the person to, and the popup then offers no button that goes nowhere.
 */
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

/** Key of the sentence of an alert (`alert.popup.type.*`); the generic one for a type this version of the app does not know. */
export function alertTypeKey(alertType: string): string {
  return `alert.popup.type.${isKnownAlertType(alertType) ? alertType : 'generic'}`;
}

/** The ways to answer «Ricordamelo più tardi»; each is also the last part of the key of its label (`alert.remindMeLater.*`). */
export const REMIND_CHOICES = ['15min', '1hour', '4hours', 'tomorrow'] as const;

type RemindChoice = (typeof REMIND_CHOICES)[number];

const MINUTE_MS = 60_000;
const REMIND_AFTER_MS: Record<Exclude<RemindChoice, 'tomorrow'>, number> = {
  '15min': 15 * MINUTE_MS,
  '1hour': 60 * MINUTE_MS,
  '4hours': 4 * 60 * MINUTE_MS,
};

/** The moment a choice stands for, counted from `now`. «Domani alle 9:00» is 09:00 of the next day on the clock of Rome. */
export function remindAtFor(choice: RemindChoice, now: Date): Date | null {
  if (choice !== 'tomorrow') return new Date(now.getTime() + REMIND_AFTER_MS[choice]);
  const nineInRome = romeWallTimeToUtc(addDays(todayInRome(now), 1), '09:00');
  return nineInRome ? new Date(nineInRome) : null;
}

/**
 * The choices to offer at `now`, each with whether it is off: a moment after the `deadline` of the alert (when it has one) cannot be
 * chosen, the server refuses it (ADR-025-R10).
 */
export function remindOptions(now: Date, deadline?: Date): Array<{ choice: RemindChoice; disabled: boolean }> {
  return REMIND_CHOICES.flatMap((choice) => {
    const remindAt = remindAtFor(choice, now);
    return remindAt ? [{ choice, disabled: deadline !== undefined && remindAt.getTime() > deadline.getTime() }] : [];
  });
}
