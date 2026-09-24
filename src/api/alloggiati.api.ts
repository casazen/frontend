import { ApiClient } from './client';
import type {
  AlloggiatiGuestSummaryDto,
  AlloggiatiStatusDto,
  AlloggiatiSummaryDto,
  MarkAlloggiatiSentManuallyRequest,
} from '@/types/alloggiati.types';

export const alloggiatiApi = {
  getSummary: (propertyId?: string) =>
    ApiClient.get<AlloggiatiSummaryDto[]>('/alloggiati/summary', propertyId ? { propertyId } : undefined),

  getStatus: (bookingId: string) =>
    ApiClient.get<AlloggiatiStatusDto>(`/alloggiati/${bookingId}/status`),

  /** Per-guest data to copy on the Questura portal, in the order of the Alloggiati record. */
  getGuestSummary: (bookingId: string) =>
    ApiClient.get<AlloggiatiGuestSummaryDto>(`/alloggiati/${bookingId}/guest-summary`),

  /** The host declares having sent the schedina on the portal (CasaZen does not transmit yet). */
  markSentManually: (bookingId: string, request: MarkAlloggiatiSentManuallyRequest) =>
    ApiClient.post<AlloggiatiStatusDto>(`/alloggiati/${bookingId}/mark-sent-manually`, request),
};
