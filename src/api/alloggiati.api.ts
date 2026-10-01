import { ApiClient } from './client';
import axios from '@/lib/axios';
import { withJsonErrorBody } from '@/lib/file-download';
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

  /**
   * GET /alloggiati/{bookingId}/record-file — the text file (one 168-character line per guest) to upload on the
   * Alloggiati Web portal, menu "File" (CO-13). Built on request, never stored; needs `guest.read` because it holds the
   * identity documents. Downloading is not sending: no status changes. A refusal (422: data or codes to complete, stay
   * over 30 days, a name the portal cannot take) arrives as a JSON problem.
   */
  downloadRecordFile: async (bookingId: string): Promise<Blob> => {
    try {
      const response = await axios.get<Blob>(`/alloggiati/${bookingId}/record-file`, { responseType: 'blob' });
      return response.data;
    } catch (error) {
      throw await withJsonErrorBody(error);
    }
  },

  /** Replaces the guests of the stay (host entry); answers the updated per-guest summary. */
  replaceStayGuests: (bookingId: string, guests: StayGuestSubmit[]) =>
    ApiClient.put<AlloggiatiGuestSummaryDto>(`/alloggiati/${bookingId}/stay-guests`, { guests }),

  /** Official Alloggiati codes matching `q` (empty until an admin imports the tables). */
  searchCodes: (list: AlloggiatiCodeList, q: string) =>
    ApiClient.get<AlloggiatiCodeEntryDto[]>('/alloggiati/codes', { list, q }),

  /** The host declares having sent the schedina on the portal (CasaZen does not transmit). */
  markSentManually: (bookingId: string, request: MarkAlloggiatiSentManuallyRequest) =>
    ApiClient.post<AlloggiatiStatusDto>(`/alloggiati/${bookingId}/mark-sent-manually`, request),
};
