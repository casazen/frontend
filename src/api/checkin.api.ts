import axios from '@/lib/axios';
import { ApiClient } from './client';
import type {
  CheckInContextDto,
  GuestCheckInDataResponse,
  GuestDocumentUploadResponse,
  SubmitGuestCheckInRequest,
} from '@/types/alloggiati.types';

/**
 * Public guest check-in API — token in path replaces auth (AllowAnonymous).
 */
export const checkinApi = {
  getContext: (token: string) =>
    ApiClient.get<CheckInContextDto>(`/checkin/${token}`),

  submitGuestData: (token: string, data: SubmitGuestCheckInRequest) =>
    ApiClient.post<GuestCheckInDataResponse>(`/checkin/${token}/guest-data`, data),

  uploadDocument: async (token: string, file: File): Promise<GuestDocumentUploadResponse> => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await axios.post<GuestDocumentUploadResponse>(
      `/checkin/${token}/document`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
    return response.data;
  },
};
