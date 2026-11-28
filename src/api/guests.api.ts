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
  getAll: (params: GuestListParams = {}) =>
    ApiClient.get<PagedResult<GuestSummary>>('/guests', {
      ...(params.search ? { search: params.search } : {}),
      ...(params.page ? { page: params.page } : {}),
      ...(params.pageSize ? { pageSize: params.pageSize } : {}),
    }),

  getById: (id: string) =>
    ApiClient.get<Guest>(`/guests/${id}`),

  getDocumentNumber: (id: string) =>
    ApiClient.get<GuestDocumentNumber>(`/guests/${id}/document-number`),

  getByEmail: (email: string) =>
    ApiClient.get<Guest>(`/guests/email/${encodeURIComponent(email)}`),

  create: (data: CreateGuestDto) =>
    ApiClient.post<Guest>('/guests', data),

  update: (id: string, data: UpdateGuestDto) =>
    ApiClient.put<Guest>(`/guests/${id}`, data),

  delete: (id: string) =>
    ApiClient.delete<void>(`/guests/${id}`),

  downloadDocumentScan: async (id: string): Promise<Blob> => {
    try {
      const response = await axios.get<Blob>(`/guests/${id}/document-scan`, { responseType: 'blob' });
      return response.data;
    } catch (error) {
      throw await withJsonErrorBody(error);
    }
  },
};
