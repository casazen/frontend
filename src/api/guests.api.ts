import { apiClient } from './client';
import type { Guest, CreateGuestDto, UpdateGuestDto } from '@/types';

export const guestsApi = {
  // GET /api/guests
  async getAll(search?: string): Promise<Guest[]> {
    const response = await apiClient.get<Guest[]>('/guests', {
      params: { search },
    });
    return response.data;
  },

  // GET /api/guests/{id}
  async getById(id: string): Promise<Guest> {
    const response = await apiClient.get<Guest>(`/guests/${id}`);
    return response.data;
  },

  // GET /api/guests/email/{email}
  async getByEmail(email: string): Promise<Guest> {
    const response = await apiClient.get<Guest>(`/guests/email/${email}`);
    return response.data;
  },

  // POST /api/guests
  async create(data: CreateGuestDto): Promise<Guest> {
    const response = await apiClient.post<Guest>('/guests', data);
    return response.data;
  },

  // PUT /api/guests/{id}
  async update(id: string, data: UpdateGuestDto): Promise<Guest> {
    const response = await apiClient.put<Guest>(`/guests/${id}`, data);
    return response.data;
  },

  // DELETE /api/guests/{id}
  async delete(id: string): Promise<void> {
    await apiClient.delete(`/guests/${id}`);
  },
};
