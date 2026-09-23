import { ApiClient } from './client';
import type {
  Guest,
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
};
