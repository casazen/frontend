import axios from '@/lib/axios';
import { UnexpectedApiResponseError } from '@/lib/api-errors';
import { ApiClient } from './client';
import type {
  CedolareAdvisory,
  CreateLeaseDto,
  LeaseDetail,
  LeaseRegistration,
  LeaseSummary,
  ManualRegistrationInput,
  RliChecklist,
  SigningInitiatedResult,
  TriggerRegistrationResult,
} from '@/types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** The list endpoint returns a JSON array: anything else (HTML fallback, error envelope) is a load error. */
function expectArray<T>(data: unknown, url: string): T[] {
  if (!Array.isArray(data)) throw new UnexpectedApiResponseError(url);
  return data as T[];
}

/** Single-resource endpoints return a JSON object with an `id`. */
function expectObjectWithId<T>(data: unknown, url: string): T {
  if (!isRecord(data) || typeof data.id !== 'string') throw new UnexpectedApiResponseError(url);
  return data as T;
}

export const leasesApi = {
  getAll: async (params?: { propertyId?: string; status?: string }): Promise<LeaseSummary[]> =>
    expectArray<LeaseSummary>(await ApiClient.get<unknown>('/leases', params), '/leases'),

  getById: async (id: string): Promise<LeaseDetail> =>
    expectObjectWithId<LeaseDetail>(await ApiClient.get<unknown>(`/leases/${id}`), '/leases/:id'),

  create: async (data: CreateLeaseDto): Promise<LeaseDetail> =>
    expectObjectWithId<LeaseDetail>(await ApiClient.post<unknown>('/leases', data), '/leases'),

  initiateSigning: (id: string) =>
    ApiClient.post<SigningInitiatedResult>(`/leases/${id}/signing`),

  triggerRegistration: (id: string, body: { tosVersion: string; attestationAccepted: boolean }) =>
    ApiClient.post<TriggerRegistrationResult>(`/leases/${id}/registration`, body),

  /** LT-01: the landlord registered the contract on the official channel and declares number, date and receipt. */
  declareManualRegistration: async (id: string, input: ManualRegistrationInput): Promise<LeaseRegistration> => {
    const formData = new FormData();
    formData.append('registrationCode', input.registrationCode);
    formData.append('registrationDate', input.registrationDate);
    formData.append('receipt', input.receipt);
    const response = await axios.post<LeaseRegistration>(`/leases/${id}/registration/manual`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

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
