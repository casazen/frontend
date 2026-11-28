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
  downloadDirectReceipt: async (bookingId: string): Promise<Blob> =>
    (await axios.get<Blob>(`/alloggiati/${encodeURIComponent(bookingId)}/direct-receipt`, { responseType: 'blob' })).data,

  getSummary: (propertyId?: string) =>
    ApiClient.get<AlloggiatiSummaryDto[]>('/alloggiati/summary', propertyId ? { propertyId } : undefined),

  /**
   * GET /alloggiati/{bookingId}/status — the status of the communication of a stay. For a stay whose sender is the channel manager it knows where the guests are on it
   * (`channelManager`: the sender, the state of each guest by position, the receipt coverage, the light and the action `RetryOctorateWrite`); the two derived states
   * `EntrustedToChannelManager` and `ChannelManagerWriteFailed` come with it (E20/F01/US01/T02). A booking of another org, or one outside the caller's reach, answers 404.
   */
  getStatus: (bookingId: string) =>
    ApiClient.get<AlloggiatiStatusDto>(`/alloggiati/${bookingId}/status`),

  /**
   * POST /alloggiati/{bookingId}/retry-octorate-write — the host asks to try again to write the guests of the stay to the channel manager (the action `RetryOctorateWrite`;
   * needs `alloggiati.submit`). Answers the status as it is afterwards, with `retry`: what the retry did. 409 `alloggiati_write_in_progress` while another send of the stay
   * runs (nothing was tried), 403 without the permission, 404 for a booking that is not the caller's.
   */
  retryOctorateWrite: (bookingId: string) =>
    ApiClient.post<AlloggiatiStatusDto>(`/alloggiati/${encodeURIComponent(bookingId)}/retry-octorate-write`),

  /** Per-guest data to copy on the Questura portal, in the order of the Alloggiati record. */
  getGuestSummary: (bookingId: string) =>
    ApiClient.get<AlloggiatiGuestSummaryDto>(`/alloggiati/${bookingId}/guest-summary`),

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

  replaceStayGuests: (bookingId: string, guests: StayGuestSubmit[], vehiclePlate?: string) =>
    ApiClient.put<AlloggiatiGuestSummaryDto>(
      `/alloggiati/${bookingId}/stay-guests`,
      vehiclePlate === undefined ? { guests } : { guests, vehiclePlate },
    ),

  searchCodes: (list: AlloggiatiCodeList, q: string) =>
    ApiClient.get<AlloggiatiCodeEntryDto[]>('/alloggiati/codes', { list, q }),

  markSentManually: (bookingId: string, request: MarkAlloggiatiSentManuallyRequest) =>
    ApiClient.post<AlloggiatiStatusDto>(`/alloggiati/${bookingId}/mark-sent-manually`, request),
};
