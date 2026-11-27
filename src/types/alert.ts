/**
 * The popup alerts (ADR-025): proactive notices that ask the host to do something. The API and the real-time channel write
 * enums by name, so these are the names of the backend enums `AlertType` and `AlertUrgency`.
 */
export const ALERT_TYPES = [
  'BookingNeedsReview',
  'CheckInPending',
  'CheckOutPending',
  'AlloggiatiDeadline',
  'IstatDeadline',
  'ComplianceIssue',
  'ChannelSyncError',
] as const;

export type AlertType = (typeof ALERT_TYPES)[number];

export const ALERT_URGENCIES = ['High', 'Normal', 'Low'] as const;

export type AlertUrgency = (typeof ALERT_URGENCIES)[number];

/**
 * One alert waiting for an answer: references only, never personal data (ADR-025-R5). What it is about is read from the API of
 * the entity once the person opens it.
 */
export interface PendingAlert {
  alertId: string;
  /**
   * One of {@link ALERT_TYPES}. A string and not the union: a newer server can send a name this version of the app does not
   * know, and the alert is then shown with a generic sentence instead of being lost.
   */
  alertType: string;
  /** What kind of entity the alert is about (`Booking`, `Property`, …). */
  entityType: string;
  entityId: string;
  urgency: AlertUrgency;
}
