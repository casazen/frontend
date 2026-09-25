import axios from '@/lib/axios';
import { UnexpectedApiResponseError } from '@/lib/api-errors';
import { ApiClient } from './client';
import type {
  CedolareAdvisory,
  CedolareAdvisoryInput,
  CreateLeaseDto,
  LeaseDetail,
  LeaseRegistration,
  LeaseSigningState,
  LeaseSummary,
  ManualRegistrationInput,
  OfflineSignatureInput,
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

  /** LT-02: signers (persisted), provider availability and whether the final contract can be downloaded. */
  getSigningState: async (id: string): Promise<LeaseSigningState> => {
    const data = await ApiClient.get<unknown>(`/leases/${id}/signers`);
    if (!isRecord(data) || !Array.isArray(data.signers)) throw new UnexpectedApiResponseError('/leases/:id/signers');
    return data as unknown as LeaseSigningState;
  },

  /** Provider path only (flag on and configured provider): sends the final contract to the e-signature provider. */
  initiateSigning: (id: string) =>
    ApiClient.post<SigningInitiatedResult>(`/leases/${id}/signing`),

  /** The final contract to sign offline (approved template only; 422 otherwise). */
  downloadContract: async (id: string): Promise<Blob> => {
    const response = await axios.get(`/leases/${id}/contract.pdf`, { responseType: 'blob' });
    return response.data;
  },

  /** Preview marked BOZZA (or ANTEPRIMA): never valid for signature. */
  downloadContractPreview: async (id: string): Promise<Blob> => {
    const response = await axios.get(`/leases/${id}/contract/preview`, { responseType: 'blob' });
    return response.data;
  },

  /** LT-02 offline signature: the PDF signed by every party plus the stipula date. The lease becomes Signed. */
  declareOfflineSignature: async (id: string, input: OfflineSignatureInput): Promise<LeaseDetail> => {
    const formData = new FormData();
    formData.append('stipulaDate', input.stipulaDate);
    formData.append('signedContract', input.signedContract);
    const response = await axios.post<LeaseDetail>(`/leases/${id}/signed-document`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  /** The contract signed by every party, from the private storage (authenticated download). */
  downloadSignedContract: async (id: string): Promise<Blob> => {
    const response = await axios.get(`/leases/${id}/signed-document`, { responseType: 'blob' });
    return response.data;
  },

  /** Stipula date of a lease signed before CasaZen recorded it (legacy leases): fixes the RLI deadline. */
  declareStipula: (id: string, stipulaDate: string) =>
    ApiClient.post<LeaseDetail>(`/leases/${id}/stipula`, { stipulaDate }),

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

  /** Without data the plain GET; with data a POST, so that the landlord's income never ends up in a URL. */
  getRliAdvisory: (id: string, input?: CedolareAdvisoryInput) =>
    input && Object.values(input).some((value) => value !== undefined)
      ? ApiClient.post<CedolareAdvisory>(`/leases/${id}/rli/advisory`, input)
      : ApiClient.get<CedolareAdvisory>(`/leases/${id}/rli/advisory`),

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
