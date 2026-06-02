import axios from '@/lib/axios';
import { ApiClient } from './client';
import type {
  CreateLeaseDto,
  LeaseContract,
  LeaseRegistration,
  SigningInitiatedResult,
  TriggerRegistrationResult,
} from '@/types';

export const leasesApi = {
  getAll: (params?: { propertyId?: string; status?: string }) =>
    ApiClient.get<LeaseContract[]>('/leases', params),

  getById: (id: string) => ApiClient.get<LeaseContract>(`/leases/${id}`),

  create: (data: CreateLeaseDto) => ApiClient.post<LeaseContract>('/leases', data),

  initiateSigning: (id: string) =>
    ApiClient.post<SigningInitiatedResult>(`/leases/${id}/signing`),

  triggerRegistration: (id: string) =>
    ApiClient.post<TriggerRegistrationResult>(`/leases/${id}/registration`),

  getRegistration: (id: string) =>
    ApiClient.get<LeaseRegistration>(`/leases/${id}/registration`),

  downloadReceipt: async (id: string): Promise<Blob> => {
    const response = await axios.get(`/leases/${id}/registration/receipt`, {
      responseType: 'blob',
    });
    return response.data;
  },
};
