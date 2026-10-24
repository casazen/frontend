import axios from '@/lib/axios';
import { UnexpectedApiResponseError } from '@/lib/api-errors';
import { ApiClient } from './client';
import type {
  CedolareAdvisory,
  CedolareAdvisoryInput,
  CfDraftResponse,
  LandlordDefaults,
  LeaseDetail,
  LeaseDraft,
  LeaseDraftCreated,
  LeaseDraftFlow,
  LeaseDraftSaved,
  LeaseListView,
  LeaseOrigin,
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

/** The flow of an answer, or an empty one when the answer has none: the screen then shows no state, never a wrong one. */
function flowOf(data: Record<string, unknown>): LeaseDraftFlow {
  return isFlow(data.flow) ? data.flow : { steps: [] };
}

function idsOf(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : [];
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

/** What `GET /leases` can narrow the list by (LR-01): a property, a view of the list and a text to look for. */
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

  /**
   * LR-12 / LR-13: a draft with only the property (no APE, parties, dates or rent asked yet); its id is the leaseId for a partner.
   * `origin` is chosen here and never changes: `Imported` is a contract already signed elsewhere.
   */
  createDraft: async (propertyId: string, origin?: LeaseOrigin): Promise<LeaseDraftCreated> => {
    const data = await ApiClient.post<unknown>('/leases/drafts', origin ? { propertyId, origin } : { propertyId });
    if (!isRecord(data) || typeof data.id !== 'string' || typeof data.version !== 'number') {
      throw new UnexpectedApiResponseError('/leases/drafts');
    }
    return { id: data.id, version: data.version, flow: flowOf(data) };
  },

  /**
   * E01/F02/US01: minimal ConcordatoFacile draft with property only.
   * POST to /api/leases/drafts/concordatofacile with { propertyId }.
   */
  createCfDraft: async (propertyId: string): Promise<CfDraftResponse> => {
    const data = await ApiClient.post<unknown>('/leases/drafts/concordatofacile', { propertyId });
    if (!isRecord(data) || typeof data.id !== 'string' || typeof data.propertyId !== 'string' || typeof data.status !== 'string') {
      throw new UnexpectedApiResponseError('/leases/drafts/concordatofacile');
    }
    return { id: data.id, propertyId: data.propertyId, status: data.status as LeaseStatus };
  },

  /** LR-12: every value of the draft, not masked, with its version and the flow (what each step still needs). */
  getDraft: async (id: string): Promise<LeaseDraft> => {
    const data = await ApiClient.get<unknown>(`/leases/${id}/draft`);
    if (!isRecord(data) || typeof data.version !== 'number' || !isRecord(data.values) || !isFlow(data.flow)) {
      throw new UnexpectedApiResponseError('/leases/:id/draft');
    }
    return data as unknown as LeaseDraft;
  },

  /** LR-12: the values of one step of a draft, saved on `version` (409 when another save came first: nothing is written). */
  saveDraft: async (
    id: string,
    save: { version: number; step: number; values: Record<string, unknown> },
  ): Promise<LeaseDraftSaved> => {
    const data = await ApiClient.patch<unknown>(`/leases/${id}/draft`, save);
    if (!isRecord(data) || typeof data.version !== 'number') throw new UnexpectedApiResponseError('/leases/:id/draft');
    return { version: data.version, flow: flowOf(data), landlordIds: idsOf(data.landlordIds), tenantIds: idsOf(data.tenantIds) };
  },

  /** LR-12: the checks of the review of a draft, worst first. */
  getReview: async (id: string): Promise<LeaseReview> => {
    const data = await ApiClient.get<unknown>(`/leases/${id}/review`);
    if (!isRecord(data) || !Array.isArray(data.checks) || !isRecord(data.counts)) {
      throw new UnexpectedApiResponseError('/leases/:id/review');
    }
    return data as unknown as LeaseReview;
  },

  /** LR-12: confirms the review (422 while a check blocks); a later change of the first steps withdraws it. */
  confirmReview: async (id: string, version: number): Promise<LeaseReviewConfirmation> => {
    const data = await ApiClient.post<unknown>(`/leases/${id}/review/confirm`, { version });
    if (!isRecord(data) || typeof data.version !== 'number') throw new UnexpectedApiResponseError('/leases/:id/review/confirm');
    return { version: data.version, reviewConfirmedAt: typeof data.reviewConfirmedAt === 'string' ? data.reviewConfirmedAt : null, flow: flowOf(data) };
  },

  /** LR-12: takes the confirmation of the review back, and with it «downloaded for the signature». */
  withdrawReviewConfirmation: async (id: string, version: number): Promise<LeaseReviewConfirmation> => {
    const response = await axios.delete<unknown>(`/leases/${id}/review/confirm`, { data: { version } });
    const data = response.data;
    if (!isRecord(data) || typeof data.version !== 'number') throw new UnexpectedApiResponseError('/leases/:id/review/confirm');
    return { version: data.version, reviewConfirmedAt: typeof data.reviewConfirmedAt === 'string' ? data.reviewConfirmedAt : null, flow: flowOf(data) };
  },

  /**
   * LR-12: records that the contract was downloaded to be signed on paper. It needs the review confirmed and passes the same gate as
   * the download: 422 `contract_template_not_approved` while the model of the contract is a draft (nothing changes then).
   */
  markSent: async (id: string, version: number): Promise<LeaseSent> => {
    const data = await ApiClient.post<unknown>(`/leases/${id}/sent`, { version });
    if (!isRecord(data) || typeof data.version !== 'number') throw new UnexpectedApiResponseError('/leases/:id/sent');
    return { version: data.version, sentForSignatureAt: typeof data.sentForSignatureAt === 'string' ? data.sentForSignatureAt : null, flow: flowOf(data) };
  },

  /** LR-12: takes the download for the signature back, so the contract can be changed. */
  revokeSent: async (id: string, version: number): Promise<LeaseSent> => {
    const response = await axios.delete<unknown>(`/leases/${id}/sent`, { data: { version } });
    const data = response.data;
    if (!isRecord(data) || typeof data.version !== 'number') throw new UnexpectedApiResponseError('/leases/:id/sent');
    return { version: data.version, sentForSignatureAt: typeof data.sentForSignatureAt === 'string' ? data.sentForSignatureAt : null, flow: flowOf(data) };
  },

  /** LR-12: the figures of the long-term area the server applies (terms, deposit limit, types): none is written in the interface. */
  getRules: async (): Promise<LongRentRules> => {
    const data = await ApiClient.get<unknown>('/long-rent/rules');
    if (!isRecord(data) || !isRecord(data.termMonths) || !Array.isArray(data.availableTypes) || !Array.isArray(data.importedTypes)) {
      throw new UnexpectedApiResponseError('/long-rent/rules');
    }
    return data as unknown as LongRentRules;
  },

  /** LR-12: the landlord the wizard starts from (not masked, only for who may create a lease). */
  getLandlordDefaults: async (): Promise<LandlordDefaults> => {
    const data = await ApiClient.get<unknown>('/long-rent/landlord-defaults');
    if (!isRecord(data)) throw new UnexpectedApiResponseError('/long-rent/landlord-defaults');
    return data as unknown as LandlordDefaults;
  },

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

  /**
   * LR-13: brings in a contract already signed elsewhere, from a draft made with `origin: Imported`: the PDF and the day it was signed.
   * The lease becomes Signed (a second call is 409 `lease_not_draft`); the registration is declared afterwards. Nothing is written
   * when the answer is an error.
   */
  importSigned: async (id: string, input: OfflineSignatureInput): Promise<LeaseDetail> => {
    const formData = new FormData();
    formData.append('stipulaDate', input.stipulaDate);
    formData.append('signedContract', input.signedContract);
    const response = await axios.post<LeaseDetail>(`/leases/${id}/import`, formData, {
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

  /** LT-07: delivery date of the property (`YYYY-MM-DD`), or null to use the start date again. Returns the checklist. */
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
