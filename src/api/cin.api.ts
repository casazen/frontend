import { ApiClient } from './client';
import type { CinComplianceResponse, UpdatePropertyCinRequest } from '@/types/cin.types';

export const CinApi = {
  getCompliance: (params?: { cinStatus?: string; page?: number; pageSize?: number }) =>
    ApiClient.get<CinComplianceResponse>('/properties/cin-compliance', params),

  updatePropertyCin: (propertyId: string, data: UpdatePropertyCinRequest) =>
    ApiClient.put<void>(`/properties/${propertyId}/cin`, data),
};
