import { ApiClient } from './client';
import axios from '@/lib/axios';
import { withJsonErrorBody } from '@/lib/file-download';
import type {
  CancellationPolicyOption,
  Property,
  CreatePropertyDto,
  UpdatePropertyDto,
  PropertySearchParams,
  PropertyDetailDto,
  PropertyDocumentDto,
  PublicPropertyDto,
  PublicPropertyDetailDto,
  PropertyCadastralData,
  ApeIdentification,
  PropertyPauseStatus,
  PlanUsage,
} from '@/types';

export const propertiesApi = {
  getAll: (params?: Record<string, string | number | boolean | undefined>) =>
    ApiClient.get<Property[]>('/properties', params),

  getById: (id: string) => ApiClient.get<Property>(`/properties/${id}`),

  getPlanUsage: () => ApiClient.get<PlanUsage>('/properties/plan-usage'),

  getCancellationPolicies: () =>
    ApiClient.get<CancellationPolicyOption[]>('/properties/cancellation-policies'),

  create: (data: CreatePropertyDto) =>
    ApiClient.post<Property>('/properties', data),

  update: (id: string, data: UpdatePropertyDto) =>
    ApiClient.put<void>(`/properties/${id}`, data),

  delete: (id: string) => ApiClient.delete<void>(`/properties/${id}`),

  setResponsible: (id: string, userId: string | null) =>
    ApiClient.put<void>(`/properties/${id}/responsible`, { userId }),

  /**
   * Dedicated pause/activate actions (A2-05): reversible, temporary — hidden from public search and new guest
   * bookings, but the property stays fully visible to its host and keeps its plan slot. Never fails on unrelated
   * fields (unlike a generic `update`).
   */
  pause: (id: string) => ApiClient.post<PropertyPauseStatus>(`/properties/${id}/pause`),
  activate: (id: string) => ApiClient.post<PropertyPauseStatus>(`/properties/${id}/activate`),

  search: (params: PropertySearchParams) => {
    const apiParams: Record<string, string | number | undefined> = {};
    if (params.city?.trim()) apiParams.city = params.city.trim();
    if (params.minPrice !== undefined) apiParams.minPrice = params.minPrice;
    if (params.maxPrice !== undefined) apiParams.maxPrice = params.maxPrice;
    if (params.minBedrooms !== undefined) apiParams.bedrooms = params.minBedrooms;
    if (params.minBathrooms !== undefined) apiParams.bathrooms = params.minBathrooms;
    if (params.guests !== undefined) apiParams.guests = params.guests;
    return ApiClient.get<PublicPropertyDto[]>('/properties/search', apiParams, { public: true });
  },

  getPublicProperty: (id: string) =>
    ApiClient.get<PublicPropertyDetailDto>(`/properties/${id}/public`, undefined, { public: true }),

  getDocuments: (id: string) =>
    ApiClient.get<PropertyDocumentDto[]>(`/properties/${id}/documents`),

  getDetail: (id: string) =>
    ApiClient.get<PropertyDetailDto>(`/properties/${id}/detail`),

  uploadDocument: async (id: string, file: File, documentType: string): Promise<PropertyDocumentDto> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('documentType', documentType);
    const response = await axios.post<PropertyDocumentDto>(
      `/properties/${id}/documents`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 120_000 }
    );
    return response.data;
  },

  deleteDocument: (id: string, docId: string) =>
    ApiClient.delete<void>(`/properties/${id}/documents/${docId}`),

  updateCadastral: (id: string, data: PropertyCadastralData) =>
    ApiClient.put<void>(`/properties/${id}/cadastral`, data),

  updateApeIdentification: (id: string, docId: string, data: ApeIdentification) =>
    ApiClient.put<PropertyDocumentDto>(`/properties/${id}/documents/${docId}/ape`, data),

  readApeIdentification: async (id: string, docId: string): Promise<PropertyDocumentDto> => {
    const response = await axios.post<PropertyDocumentDto>(`/properties/${id}/documents/${docId}/ape/read`, undefined, { timeout: 120_000 });
    return response.data;
  },

  downloadDocument: async (id: string, docId: string): Promise<Blob> => {
    try {
      const response = await axios.get<Blob>(`/properties/${id}/documents/${docId}/download`, {
        responseType: 'blob',
      });
      return response.data;
    } catch (error) {
      throw await withJsonErrorBody(error);
    }
  },
};
