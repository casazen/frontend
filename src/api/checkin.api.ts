import { ApiClient } from './client';
import type {
  AlloggiatiCodeEntryDto,
  AlloggiatiCodeList,
  BiometricVerificationResponse,
  PublicCheckInContextDto,
  PublicCheckInSubmitRequest,
} from '@/types/public-checkin.types';

export const publicCheckinApi = {
  getContext: (token: string) =>
    ApiClient.get<PublicCheckInContextDto>(`/public/checkin/${token}`, undefined, { public: true }),

  submit: (token: string, data: PublicCheckInSubmitRequest) =>
    ApiClient.post<{ sessionId: string; message: string }>(`/public/checkin/${token}`, data, { public: true }),

  /** Official Alloggiati codes matching `q` (empty until an admin imports the tables). */
  searchCodes: (token: string, list: AlloggiatiCodeList, q: string) =>
    ApiClient.get<AlloggiatiCodeEntryDto[]>(`/public/checkin/${token}/codes`, { list, q }, { public: true }),

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
