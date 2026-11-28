type PendingBiometricOutcome = 'Accept' | 'Escalate' | 'Reject';

export interface VerificationReason {
  check: string;
  result: string;
  value?: number | null;
  threshold?: number | null;
}

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
  reasons?: VerificationReason[];
  provisional?: boolean;
}

export interface VerificationDecisionRequest {
  outcome: boolean;
  note?: string;
}

/**
 * The meeting an operator created for a video call with the guest (`POST /api/verification/{bookingId}/video-call`, E22/F01/US01/T03): any provider, an absolute `https` address of at most 500
 * characters, with no spaces and no credentials in it. It is never fetched; it goes to the guest by e-mail and is kept in no table of CasaZen.
 */
export interface VideoCallRequest {
  url: string;
}

export interface VideoCallProposed {
  status: 'sent';
}

export interface VerificationRejectionRequest {
  reason: string;
}

export interface VerificationMetricsPeriod {
  from?: string;
  to?: string;
}

export interface VerificationMetrics {
  from: string;
  to: string;
  ok: number;
  review: number;
  notOk: number;
  operatorApproved: number;
  operatorRejected: number;
  operatorDecisions: number;
  operatorShare: number;
}
