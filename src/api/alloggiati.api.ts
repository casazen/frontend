import { ApiClient } from './client';
import type {
  AlloggiatiGuestSummaryDto,
  AlloggiatiStatusDto,
  AlloggiatiSummaryDto,
  MarkAlloggiatiSentManuallyRequest,
  StayGuestDocumentNumberDto,
} from '@/types/alloggiati.types';
import type { AlloggiatiCodeEntryDto, AlloggiatiCodeList, StayGuestSubmit } from '@/types/public-checkin.types';

export const alloggiatiApi = {
  getSummary: (propertyId?: string) =>
    ApiClient.get<AlloggiatiSummaryDto[]>('/alloggiati/summary', propertyId ? { propertyId } : undefined),

  getStatus: (bookingId: string) =>
    ApiClient.get<AlloggiatiStatusDto>(`/alloggiati/${bookingId}/status`),

  /** Per-guest data to copy on the Questura portal, in the order of the Alloggiati record. */
  getGuestSummary: (bookingId: string) =>
    ApiClient.get<AlloggiatiGuestSummaryDto>(`/alloggiati/${bookingId}/guest-summary`),

  /**
   * Full document numbers of the guests of the stay (the summary shows them masked); `position` limits the answer to
   * one guest. Every request is audited by the API.
   */
  getDocumentNumbers: (bookingId: string, position?: number) =>
    ApiClient.get<StayGuestDocumentNumberDto[]>(
      `/alloggiati/${bookingId}/stay-guests/document-numbers`,
      position === undefined ? undefined : { position },
    ),

  /** Replaces the guests of the stay (host entry); answers the updated per-guest summary. */
  replaceStayGuests: (bookingId: string, guests: StayGuestSubmit[]) =>
    ApiClient.put<AlloggiatiGuestSummaryDto>(`/alloggiati/${bookingId}/stay-guests`, { guests }),

  /** Official Alloggiati codes matching `q` (empty until an admin imports the tables). */
  searchCodes: (list: AlloggiatiCodeList, q: string) =>
    ApiClient.get<AlloggiatiCodeEntryDto[]>('/alloggiati/codes', { list, q }),

  /** The host declares having sent the schedina on the portal (CasaZen does not transmit yet). */
  markSentManually: (bookingId: string, request: MarkAlloggiatiSentManuallyRequest) =>
    ApiClient.post<AlloggiatiStatusDto>(`/alloggiati/${bookingId}/mark-sent-manually`, request),
};
