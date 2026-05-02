import { ApiClient } from './client';
import type {
  OtaIntegration,
  CreateOtaIntegrationDto,
  UpdateOtaIntegrationDto,
  SyncResult,
  SyncAllResult,
  OtaPricingUpdate,
  OtaPlatform,
  ValidationResult,
} from '@/types';

export const otaApi = {
  getAll: (params?: Record<string, any>) =>
    ApiClient.get<OtaIntegration[]>('/ota', params),

  getById: (id: string) => ApiClient.get<OtaIntegration>(`/ota/${id}`),

  create: (data: CreateOtaIntegrationDto) =>
    ApiClient.post<OtaIntegration>('/ota', data),

  update: (id: string, data: UpdateOtaIntegrationDto) =>
    ApiClient.put<OtaIntegration>(`/ota/${id}`, data),

  delete: (id: string) => ApiClient.delete<void>(`/ota/${id}`),

  syncAll: () => ApiClient.post<SyncAllResult>('/ota/sync/all'),

  syncPlatform: (platform: OtaPlatform) =>
    ApiClient.post<SyncResult>(`/ota/sync/${platform}`),

  getStatus: () => ApiClient.get<SyncResult[]>('/ota/sync/status'),

  updatePricing: (data: OtaPricingUpdate) =>
    ApiClient.post<void>('/ota/pricing', data),

  validate: (id: string) =>
    ApiClient.post<ValidationResult>(`/ota/${id}/validate`),
};
