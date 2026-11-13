import { ApiClient } from './client';
import type {
  PendingVerification,
  VerificationDecisionRequest,
  VerificationMetrics,
  VerificationMetricsPeriod,
  VerificationRejectionRequest,
} from '@/types/verification.types';

/**
 * Verification queue API (NF-12, ADR-013).
 * Operator verification queue for manual biometric verification decisions.
 */
export const verificationApi = {
  /** Get bookings pending manual verification within the caller's scope (AC-NF12-3), with the reasons of the last automatic outcome. */
  getPending: () =>
    ApiClient.get<PendingVerification[]>('/verification/pending'),

  /** The figures of the verifications of a period (the last 30 days when none is given) for the bookings the caller reaches (NF-51 monitoring). */
  getMetrics: (period?: VerificationMetricsPeriod) =>
    ApiClient.get<VerificationMetrics>('/verification/metrics', period),

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
