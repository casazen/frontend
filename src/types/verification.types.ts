/**
 * Verification queue types (NF-12, ADR-013, E03/F04/US03/T02).
 * Mirrors backend DTOs from Casazen.Web/DTOs/Verification.
 */

/** What the automatic check decided on its last attempt (API enum `BiometricOutcome`, sent as text). */
export type PendingBiometricOutcome = 'Accept' | 'Escalate' | 'Reject';

/**
 * One check of the last automatic outcome (AC-NF51-5): `check` and `result` are codes the console translates, `value` is the number measured and
 * `threshold` the one it was compared with, when the check has them. Codes and numbers only: never an image, a name or a document value.
 */
export interface VerificationReason {
  check: string;
  result: string;
  value?: number | null;
  threshold?: number | null;
}

/** A booking awaiting manual verification in the operator queue. */
export interface PendingVerification {
  bookingId: string;
  propertyId: string;
  propertyName: string;
  checkInDate: string;
  checkOutDate: string;
  guestName: string;
  guestEmail?: string | null;
  biometricOutcome?: PendingBiometricOutcome | string | null;
  biometricAttempts: number;
  raisedAt: string;
  /** The checks of the last automatic outcome. Add-only field: empty when the guest went to the operator without one (an older API omits it). */
  reasons?: VerificationReason[];
  /** The thresholds of that outcome were never calibrated: the console says the outcome is provisional. Add-only field. */
  provisional?: boolean;
}

/** Request to record a manual verification decision (AC-NF12-6). */
export interface VerificationDecisionRequest {
  /** True for acceptance, false for rejection. */
  outcome: boolean;
  /** Operator's note (required for rejection, optional for acceptance). */
  note?: string;
}

/** Request to reject a guest's check-in (AC-NF12-7). */
export interface VerificationRejectionRequest {
  /** Reason for rejecting the verification. */
  reason: string;
}

/** The period of `GET /api/verification/metrics`: days (`YYYY-MM-DD`, Europe/Rome), both included. Without it the API answers the last 30 days. */
export interface VerificationMetricsPeriod {
  from?: string;
  to?: string;
}

/** The figures of the identity verifications of a period for the bookings the caller reaches (monitoring of NF-51). */
export interface VerificationMetrics {
  /** First day of the period. */
  from: string;
  /** Last day of the period, included. */
  to: string;
  /** Automatic outcomes: passed. */
  ok: number;
  /** Automatic outcomes: sent to a person. */
  review: number;
  /** Automatic outcomes: not passed. */
  notOk: number;
  /** Decisions of the operators: approved. */
  operatorApproved: number;
  /** Decisions of the operators: rejected. */
  operatorRejected: number;
  /** Every decision of an operator. */
  operatorDecisions: number;
  /** Operator decisions / (automatic ok + operator decisions): the share of the concluded verifications an operator concluded, 0 to 1. */
  operatorShare: number;
}
