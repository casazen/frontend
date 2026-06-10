import { ApiClient } from './client';
import type { AlloggiatiStatusDto, AlloggiatiSummaryDto } from '@/types/alloggiati.types';

export const alloggiatiApi = {
  getSummary: (propertyId?: string) =>
    ApiClient.get<AlloggiatiSummaryDto[]>('/alloggiati/summary', propertyId ? { propertyId } : undefined),

  getStatus: (bookingId: string) =>
    ApiClient.get<AlloggiatiStatusDto>(`/alloggiati/${bookingId}/status`),

  sendReport: (bookingId: string) =>
    ApiClient.post<AlloggiatiStatusDto>(`/alloggiati/${bookingId}/send`),
};
