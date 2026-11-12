import axios from '@/lib/axios';
import { ApiClient } from './client';
import type {
  AlloggiatiCodeEntryDto,
  AlloggiatiCodeList,
  BiometricVerificationResponse,
  CheckInDocumentReadResult,
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
   * Submit a selfie for biometric verification. The backend processes it synchronously
   * and returns the outcome within 3 seconds per ADR-013-R1.
   */
  submitSelfie: (token: string, imageBlob: Blob) => {
    const formData = new FormData();
    formData.append('selfie', imageBlob, 'selfie.jpg');
    return ApiClient.post<BiometricVerificationResponse>(
      `/public/checkin/${token}/selfie`,
      formData,
      { public: true }
    );
  },
};
