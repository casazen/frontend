import axios from '@/lib/axios';
import { ApiClient } from './client';
import type {
  CedolareAdvisory,
  CreateLeaseDto,
  LeaseContract,
  LeaseRegistration,
  RliChecklist,
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

  triggerRegistration: (id: string, body: { tosVersion: string; attestationAccepted: boolean }) =>
    ApiClient.post<TriggerRegistrationResult>(`/leases/${id}/registration`, body),

  getRegistration: (id: string) =>
    ApiClient.get<LeaseRegistration>(`/leases/${id}/registration`),

  getRliAdvisory: (id: string) =>
    ApiClient.get<CedolareAdvisory>(`/leases/${id}/rli/advisory`),

  getRliChecklist: (id: string) =>
    ApiClient.get<RliChecklist>(`/leases/${id}/rli/checklist`),

  exportRli: async (id: string): Promise<Blob> => {
    const response = await axios.get(`/leases/${id}/rli/export`, {
      responseType: 'blob',
    });
    return response.data;
  },

  downloadReceipt: async (id: string): Promise<Blob> => {
    const response = await axios.get(`/leases/${id}/registration/receipt`, {
      responseType: 'blob',
    });
    return response.data;
  },
};
