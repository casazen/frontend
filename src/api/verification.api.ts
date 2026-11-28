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

export const verificationApi = {
  getPending: () =>
    ApiClient.get<PendingVerification[]>('/verification/pending'),

  getMetrics: (period?: VerificationMetricsPeriod) =>
    ApiClient.get<VerificationMetrics>('/verification/metrics', period),

  requestNewPhoto: (bookingId: string) =>
    ApiClient.post<void>(`/verification/${bookingId}/request-photo`),

  proposeVideoCall: (bookingId: string, request: VideoCallRequest) =>
    ApiClient.post<VideoCallProposed>(`/verification/${bookingId}/video-call`, request),

  recordVerification: (bookingId: string, data: VerificationDecisionRequest) =>
    ApiClient.post<void>(`/verification/${bookingId}/verify`, data),

  rejectVerification: (bookingId: string, data: VerificationRejectionRequest) =>
    ApiClient.post<void>(`/verification/${bookingId}/reject`, data),
};
