import axios from '@/lib/axios';
import { UnexpectedApiResponseError } from '@/lib/api-errors';
import { ApiClient } from './client';
import type {
  CedolareAdvisory,
  CedolareAdvisoryInput,
  CfDraftResponse,
  ImportSignedInput,
  LandlordDefaults,
  LeaseDetail,
  LeaseDraft,
  LeaseDraftCreated,
  LeaseDraftFlow,
  LeaseDraftSaved,
  LeaseListView,
  LeaseOrigin,
  LeaseReading,
  LeaseRegistration,
  LeaseReview,
  LeaseReviewConfirmation,
  LeaseSent,
  LeaseSigningState,
  LeaseStatus,
  LeaseSummary,
  LongRentRules,
  ManualRegistrationInput,
  OfflineSignatureInput,
  QuesturaCommunicationInput,
  RliChecklist,
  SigningInitiatedResult,
  TriggerRegistrationResult,
} from '@/types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFlow(value: unknown): value is LeaseDraftFlow {
  return isRecord(value) && Array.isArray(value.steps);
}

function flowOf(data: Record<string, unknown>): LeaseDraftFlow {
  return isFlow(data.flow) ? data.flow : { steps: [] };
}

function idsOf(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : [];
}

function expectArray<T>(data: unknown, url: string): T[] {
  if (!Array.isArray(data)) throw new UnexpectedApiResponseError(url);
  return data as T[];
}

function expectObjectWithId<T>(data: unknown, url: string): T {
  if (!isRecord(data) || typeof data.id !== 'string') throw new UnexpectedApiResponseError(url);
  return data as T;
}

export interface LeaseListParams {
  propertyId?: string;
  view?: LeaseListView;
  q?: string;
}

export const leasesApi = {
  getAll: async (params?: LeaseListParams): Promise<LeaseSummary[]> =>
    expectArray<LeaseSummary>(await ApiClient.get<unknown>('/leases', params), '/leases'),

  getById: async (id: string): Promise<LeaseDetail> =>
    expectObjectWithId<LeaseDetail>(await ApiClient.get<unknown>(`/leases/${id}`), '/leases/:id'),

  createDraft: async (propertyId: string, origin?: LeaseOrigin): Promise<LeaseDraftCreated> => {
    const data = await ApiClient.post<unknown>('/leases/drafts', origin ? { propertyId, origin } : { propertyId });
    if (!isRecord(data) || typeof data.id !== 'string' || typeof data.version !== 'number') {
      throw new UnexpectedApiResponseError('/leases/drafts');
    }
    return { id: data.id, version: data.version, flow: flowOf(data) };
  },

  createCfDraft: async (propertyId: string): Promise<CfDraftResponse> => {
    const data = await ApiClient.post<unknown>('/leases/drafts/concordatofacile', { propertyId });
    if (!isRecord(data) || typeof data.id !== 'string' || typeof data.propertyId !== 'string' || typeof data.status !== 'string') {
      throw new UnexpectedApiResponseError('/leases/drafts/concordatofacile');
    }
    return { id: data.id, propertyId: data.propertyId, status: data.status as LeaseStatus };
  },

  getDraft: async (id: string): Promise<LeaseDraft> => {
    const data = await ApiClient.get<unknown>(`/leases/${id}/draft`);
    if (!isRecord(data) || typeof data.version !== 'number' || !isRecord(data.values) || !isFlow(data.flow)) {
      throw new UnexpectedApiResponseError('/leases/:id/draft');
    }
    return data as unknown as LeaseDraft;
  },

  saveDraft: async (
    id: string,
    save: { version: number; step: number; values: Record<string, unknown> },
  ): Promise<LeaseDraftSaved> => {
    const data = await ApiClient.patch<unknown>(`/leases/${id}/draft`, save);
    if (!isRecord(data) || typeof data.version !== 'number') throw new UnexpectedApiResponseError('/leases/:id/draft');
    return { version: data.version, flow: flowOf(data), landlordIds: idsOf(data.landlordIds), tenantIds: idsOf(data.tenantIds) };
  },

  getDraftReading: async (id: string): Promise<LeaseReading> => {
    const data = await ApiClient.get<unknown>(`/leases/${id}/draft/reading`);
    if (!isRecord(data) || typeof data.state !== 'string' || !Array.isArray(data.documents) || !Array.isArray(data.fields)) {
      throw new UnexpectedApiResponseError('/leases/:id/draft/reading');
    }
    return data as unknown as LeaseReading;
  },

  getReview: async (id: string): Promise<LeaseReview> => {
    const data = await ApiClient.get<unknown>(`/leases/${id}/review`);
    if (!isRecord(data) || !Array.isArray(data.checks) || !isRecord(data.counts)) {
      throw new UnexpectedApiResponseError('/leases/:id/review');
    }
    return data as unknown as LeaseReview;
  },

  confirmReview: async (id: string, version: number): Promise<LeaseReviewConfirmation> => {
    const data = await ApiClient.post<unknown>(`/leases/${id}/review/confirm`, { version });
    if (!isRecord(data) || typeof data.version !== 'number') throw new UnexpectedApiResponseError('/leases/:id/review/confirm');
    return { version: data.version, reviewConfirmedAt: typeof data.reviewConfirmedAt === 'string' ? data.reviewConfirmedAt : null, flow: flowOf(data) };
  },

  withdrawReviewConfirmation: async (id: string, version: number): Promise<LeaseReviewConfirmation> => {
    const response = await axios.delete<unknown>(`/leases/${id}/review/confirm`, { data: { version } });
    const data = response.data;
    if (!isRecord(data) || typeof data.version !== 'number') throw new UnexpectedApiResponseError('/leases/:id/review/confirm');
    return { version: data.version, reviewConfirmedAt: typeof data.reviewConfirmedAt === 'string' ? data.reviewConfirmedAt : null, flow: flowOf(data) };
  },

  markSent: async (id: string, version: number): Promise<LeaseSent> => {
    const data = await ApiClient.post<unknown>(`/leases/${id}/sent`, { version });
    if (!isRecord(data) || typeof data.version !== 'number') throw new UnexpectedApiResponseError('/leases/:id/sent');
    return { version: data.version, sentForSignatureAt: typeof data.sentForSignatureAt === 'string' ? data.sentForSignatureAt : null, flow: flowOf(data) };
  },

  revokeSent: async (id: string, version: number): Promise<LeaseSent> => {
    const response = await axios.delete<unknown>(`/leases/${id}/sent`, { data: { version } });
    const data = response.data;
    if (!isRecord(data) || typeof data.version !== 'number') throw new UnexpectedApiResponseError('/leases/:id/sent');
    return { version: data.version, sentForSignatureAt: typeof data.sentForSignatureAt === 'string' ? data.sentForSignatureAt : null, flow: flowOf(data) };
  },

  getRules: async (): Promise<LongRentRules> => {
    const data = await ApiClient.get<unknown>('/long-rent/rules');
    if (!isRecord(data) || !isRecord(data.termMonths) || !Array.isArray(data.availableTypes) || !Array.isArray(data.importedTypes)) {
      throw new UnexpectedApiResponseError('/long-rent/rules');
    }
    return data as unknown as LongRentRules;
  },

  getLandlordDefaults: async (): Promise<LandlordDefaults> => {
    const data = await ApiClient.get<unknown>('/long-rent/landlord-defaults');
    if (!isRecord(data)) throw new UnexpectedApiResponseError('/long-rent/landlord-defaults');
    return data as unknown as LandlordDefaults;
  },

  getSigningState: async (id: string): Promise<LeaseSigningState> => {
    const data = await ApiClient.get<unknown>(`/leases/${id}/signers`);
    if (!isRecord(data) || !Array.isArray(data.signers)) throw new UnexpectedApiResponseError('/leases/:id/signers');
    return data as unknown as LeaseSigningState;
  },

  initiateSigning: (id: string) =>
    ApiClient.post<SigningInitiatedResult>(`/leases/${id}/signing`),

  /** The final contract to sign offline (approved template only; 422 otherwise). */
  downloadContract: async (id: string): Promise<Blob> => {
    const response = await axios.get(`/leases/${id}/contract.pdf`, { responseType: 'blob' });
    return response.data;
  },

  downloadContractPreview: async (id: string): Promise<Blob> => {
    const response = await axios.get(`/leases/${id}/contract/preview`, { responseType: 'blob' });
    return response.data;
  },

  declareOfflineSignature: async (id: string, input: OfflineSignatureInput): Promise<LeaseDetail> => {
    const formData = new FormData();
    formData.append('stipulaDate', input.stipulaDate);
    formData.append('signedContract', input.signedContract);
    const response = await axios.post<LeaseDetail>(`/leases/${id}/signed-document`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  importSigned: async (id: string, input: ImportSignedInput): Promise<LeaseDetail> => {
    const formData = new FormData();
    formData.append('stipulaDate', input.stipulaDate);
    if ('contractDocumentId' in input) formData.append('contractDocumentId', input.contractDocumentId);
    else formData.append('signedContract', input.signedContract);
    const response = await axios.post<LeaseDetail>(`/leases/${id}/import`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  downloadSignedContract: async (id: string): Promise<Blob> => {
    const response = await axios.get(`/leases/${id}/signed-document`, { responseType: 'blob' });
    return response.data;
  },

  declareStipula: (id: string, stipulaDate: string) =>
    ApiClient.post<LeaseDetail>(`/leases/${id}/stipula`, { stipulaDate }),

  triggerRegistration: (id: string, body: { tosVersion: string; attestationAccepted: boolean }) =>
    ApiClient.post<TriggerRegistrationResult>(`/leases/${id}/registration`, body),

  createRegistrationCheckout: (id: string) =>
    ApiClient.post<{ sessionId: string; sessionUrl: string }>(`/leases/${id}/registration/checkout`),

  declareManualRegistration: async (id: string, input: ManualRegistrationInput): Promise<LeaseRegistration> => {
    const formData = new FormData();
    formData.append('registrationCode', input.registrationCode);
    formData.append('registrationDate', input.registrationDate);
    if ('receiptDocumentId' in input) formData.append('receiptDocumentId', input.receiptDocumentId);
    else formData.append('receipt', input.receipt);
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

  declareQuesturaDeliveryDate: (id: string, deliveryDate: string | null) =>
    ApiClient.put<RliChecklist>(`/leases/${id}/rli/questura/delivery-date`, { deliveryDate }),

  /** LT-07: the landlord sent the Questura communication and declares its date (and optionally the receipt PDF). */
  markQuesturaCommunicationDone: async (id: string, input: QuesturaCommunicationInput): Promise<RliChecklist> => {
    const formData = new FormData();
    formData.append('communicationDate', input.communicationDate);
    if (input.receipt) formData.append('receipt', input.receipt);
    const response = await axios.post<RliChecklist>(`/leases/${id}/rli/questura/mark-done`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  /** The receipt of the Questura communication, from the private storage (authenticated download). */
  downloadQuesturaReceipt: async (id: string): Promise<Blob> => {
    const response = await axios.get(`/leases/${id}/rli/questura/receipt`, { responseType: 'blob' });
    return response.data;
  },

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
