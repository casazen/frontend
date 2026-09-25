import { ApiClient } from './client';
import axios from '@/lib/axios';
import { withJsonErrorBody } from '@/lib/file-download';
import type {
  Guest,
  GuestDocumentNumber,
  GuestSummary,
  GuestListParams,
  CreateGuestDto,
  UpdateGuestDto,
  PagedResult,
} from '@/types';

export const guestsApi = {
  // GET /api/guests — one page of the caller org's guests (backend PagedResultDto<GuestSummaryDto>)
  getAll: (params: GuestListParams = {}) =>
    ApiClient.get<PagedResult<GuestSummary>>('/guests', {
      ...(params.search ? { search: params.search } : {}),
      ...(params.page ? { page: params.page } : {}),
      ...(params.pageSize ? { pageSize: params.pageSize } : {}),
    }),

  // GET /api/guests/{id}
  getById: (id: string) =>
    ApiClient.get<Guest>(`/guests/${id}`),

  /**
   * GET /api/guests/{id}/document-number — the full document number (every other answer masks it). Explicit action,
   * audited by the API: call it only when the host asks to see the number.
   */
  getDocumentNumber: (id: string) =>
    ApiClient.get<GuestDocumentNumber>(`/guests/${id}/document-number`),

  // GET /api/guests/email/{email}
  getByEmail: (email: string) =>
    ApiClient.get<Guest>(`/guests/email/${encodeURIComponent(email)}`),

  // POST /api/guests
  create: (data: CreateGuestDto) =>
    ApiClient.post<Guest>('/guests', data),

  // PUT /api/guests/{id}
  update: (id: string, data: UpdateGuestDto) =>
    ApiClient.put<Guest>(`/guests/${id}`, data),

  // DELETE /api/guests/{id}
  delete: (id: string) =>
    ApiClient.delete<void>(`/guests/${id}`),

  /**
   * GET /api/guests/{id}/document-scan — the identity document scan the guest uploaded. It lives in the private storage
   * bucket: fetched through the authenticated endpoint (tenant check, audited), never through a public link.
   */
  downloadDocumentScan: async (id: string): Promise<Blob> => {
    try {
      const response = await axios.get<Blob>(`/guests/${id}/document-scan`, { responseType: 'blob' });
      return response.data;
    } catch (error) {
      throw await withJsonErrorBody(error);
    }
  },
};
