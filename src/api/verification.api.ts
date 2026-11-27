import { ApiClient } from './client';
import type {
  PendingVerification,
  VerificationDecisionRequest,
  VerificationMetrics,
  VerificationMetricsPeriod,
  VerificationRejectionRequest,
  VideoCallProposed,
  VideoCallRequest,
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

  /**
   * Proposes a video call to the guest (E22/F01/US01/T03): `url` is the address of the meeting the operator created, which goes to the guest by e-mail. 422 `video_call_url_invalid`, 404
   * `no_pending_verification` (outside the scope of the caller, or not waiting for a person any more), 409 `guest_unreachable` (no e-mail address: nothing is sent) and `video_call_not_sent` (the
   * e-mail could not be queued). Behind the flag `checkInIdentityVerification`.
   */
  proposeVideoCall: (bookingId: string, request: VideoCallRequest) =>
    ApiClient.post<VideoCallProposed>(`/verification/${bookingId}/video-call`, request),

  /** Record manual verification decision (AC-NF12-6). */
  recordVerification: (bookingId: string, data: VerificationDecisionRequest) =>
    ApiClient.post<void>(`/verification/${bookingId}/verify`, data),

  /** Reject the guest's check-in (AC-NF12-7). */
  rejectVerification: (bookingId: string, data: VerificationRejectionRequest) =>
    ApiClient.post<void>(`/verification/${bookingId}/reject`, data),
};
