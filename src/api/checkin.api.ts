import axios from '@/lib/axios';
import { ApiClient } from './client';
import type {
  AlloggiatiCodeEntryDto,
  AlloggiatiCodeList,
  BiometricConsentRequest,
  BiometricConsentResponse,
  CheckInDocumentReadResult,
  IdentityDocumentResponse,
  IdentityOperatorResponse,
  IdentitySelfieResponse,
  PublicCheckInContextDto,
  PublicCheckInLanguageResponse,
  PublicCheckInSubmitRequest,
} from '@/types/public-checkin.types';

export const publicCheckinApi = {
  /**
   * The context of the link: what the form starts from. For the invoice step (FIS-01) it carries two flags, `invoiceRequested` and
   * `hasInvoiceData`, and never the invoice data itself: that is write-only from this page, because the link is anonymous.
   */
  getContext: (token: string) =>
    ApiClient.get<PublicCheckInContextDto>(`/public/checkin/${token}`, undefined, { public: true }),

  /** Saves the language the guest chose on the page (`it`, `en`, `de`, `fr` or `es`); the page and the emails of the session use it. */
  setLanguage: (token: string, language: string) =>
    ApiClient.put<PublicCheckInLanguageResponse>(`/public/checkin/${token}/language`, { language }, { public: true }),

  /**
   * Sends the check-in. The optional `invoice` block («Ti serve la fattura?», FIS-01) is there only for a yes; the server saves it with the check-in
   * or, when its data is not valid, answers 422 `invoice_data_*` with the `field` (and the list of `errors`) and saves nothing.
   */
  submit: (token: string, data: PublicCheckInSubmitRequest) =>
    ApiClient.post<{ sessionId: string; message: string }>(`/public/checkin/${token}`, data, { public: true }),

  /** Official Alloggiati codes matching `q` (empty until an admin imports the tables). */
  searchCodes: (token: string, list: AlloggiatiCodeList, q: string) =>
    ApiClient.get<AlloggiatiCodeEntryDto[]>(`/public/checkin/${token}/codes`, { list, q }, { public: true }),

  /** Reads one identity-document photo. The photo is not stored. */
  readDocument: async (token: string, file: File) => {
    const body = new FormData();
    body.append('file', file);
    const response = await axios.post<CheckInDocumentReadResult>(`/public/checkin/${token}/read-document`, body, {
      public: true,
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  /**
   * The guest's answer to the biometric consent (E03/F04/US03/T01, ADR-013-R9): explicit, separate from the privacy notice, refusable. A refusal, or a
   * verification that is not offered, answers `result: operator`: a person verifies and the operators are told at once.
   */
  postBiometricConsent: (token: string, request: BiometricConsentRequest) =>
    ApiClient.post<BiometricConsentResponse>(`/public/checkin/${token}/biometric-consent`, request, { public: true }),

  /**
   * The photo of the identity document of the guest who verifies: the answer carries the capture guidance (`acceptable`, `guidanceCodes`). The photo is
   * read in memory by the API; outside Ticino it is kept encrypted until the verification is over, in Ticino nothing is kept.
   */
  postDocument: (token: string, photo: Blob) => {
    const body = new FormData();
    body.append('document', photo, 'document.jpg');
    return ApiClient.post<IdentityDocumentResponse>(`/public/checkin/${token}/document`, body, { public: true });
  },

  /**
   * The selfie of the guest who verifies (ADR-013-R1: compared in the request, ADR-013-R2: nothing of it is kept). For a property in Ticino the photo
   * of the document comes again with it (`documentPhoto`). The answer is `ok` (with the lock code), `retry` or `operator`.
   */
  postSelfie: (token: string, selfie: Blob, documentPhoto?: Blob | null) => {
    const body = new FormData();
    body.append('selfie', selfie, 'selfie.jpg');
    if (documentPhoto) body.append('documentPhoto', documentPhoto, 'document.jpg');
    return ApiClient.post<IdentitySelfieResponse>(`/public/checkin/${token}/selfie`, body, { public: true });
  },

  /** The guest asks for a person, at any step, also after a retry or a failed attempt (GDPR art. 22, AC-NF51-11): the operators are told at once. */
  requestOperator: (token: string) =>
    ApiClient.post<IdentityOperatorResponse>(`/public/checkin/${token}/request-operator`, undefined, { public: true }),
};
