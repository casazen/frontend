import { ApiClient } from './client';
import type {
  PendingVerification,
  VerificationDecisionRequest,
  VerificationRejectionRequest,
} from '@/types/verification.types';

/**
 * Verification queue API (NF-12, ADR-013).
 * Operator verification queue for manual biometric verification decisions.
 */
export const verificationApi = {
  /** Get bookings pending manual verification within the caller's scope (AC-NF12-3). */
  getPending: () =>
    ApiClient.get<PendingVerification[]>('/verification/pending'),

  /** Request a new selfie photo from the guest (AC-NF12-5). */
  requestNewPhoto: (bookingId: string) =>
    ApiClient.post<void>(`/verification/${bookingId}/request-photo`),

  /** Record manual verification decision (AC-NF12-6). */
  recordVerification: (bookingId: string, data: VerificationDecisionRequest) =>
    ApiClient.post<void>(`/verification/${bookingId}/verify`, data),

  /** Reject the guest's check-in (AC-NF12-7). */
  rejectVerification: (bookingId: string, data: VerificationRejectionRequest) =>
    ApiClient.post<void>(`/verification/${bookingId}/reject`, data),
};
