import { ApiClient } from './client';
import type {
  PublicCheckInContextDto,
  PublicCheckInSubmitRequest,
} from '@/types/public-checkin.types';

export const publicCheckinApi = {
  getContext: (token: string) =>
    ApiClient.get<PublicCheckInContextDto>(`/public/checkin/${token}`),

  submit: (token: string, data: PublicCheckInSubmitRequest) =>
    ApiClient.post<{ sessionId: string; message: string }>(`/public/checkin/${token}`, data),
};
