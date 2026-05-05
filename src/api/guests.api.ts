import { ApiClient } from './client';
import type { Guest, CreateGuestDto, UpdateGuestDto } from '@/types';

export const guestsApi = {
  // GET /api/guests
  getAll: (search?: string) =>
    ApiClient.get<Guest[]>('/guests', search ? { search } : undefined),

  // GET /api/guests/{id}
  getById: (id: string) =>
    ApiClient.get<Guest>(`/guests/${id}`),

  // GET /api/guests/email/{email}
  getByEmail: (email: string) =>
    ApiClient.get<Guest>(`/guests/email/${email}`),

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
