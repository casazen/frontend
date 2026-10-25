/**
 * Verification queue types (NF-12, ADR-013).
 * Mirrors backend DTOs from Casazen.Web/DTOs/Verification.
 */

/** A booking awaiting manual verification in the operator queue. */
export interface PendingVerification {
  bookingId: string;
  propertyId: string;
  propertyName: string;
  checkInDate: string;
  checkOutDate: string;
  guestName: string;
  guestEmail?: string;
  biometricOutcome?: string;
  biometricAttempts: number;
  raisedAt: string;
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
