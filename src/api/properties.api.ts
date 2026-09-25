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
} from '@/types';

export const propertiesApi = {
  getAll: (params?: Record<string, string | number | boolean | undefined>) =>
    ApiClient.get<Property[]>('/properties', params),

  getById: (id: string) => ApiClient.get<Property>(`/properties/${id}`),

  getCancellationPolicies: () =>
    ApiClient.get<CancellationPolicyOption[]>('/properties/cancellation-policies'),

  create: (data: CreatePropertyDto) =>
    ApiClient.post<Property>('/properties', data),

  /** PATCH semantics on PUT (A2-04): fields left out keep their stored value. Answers 204. */
  update: (id: string, data: UpdatePropertyDto) =>
    ApiClient.put<void>(`/properties/${id}`, data),

  delete: (id: string) => ApiClient.delete<void>(`/properties/${id}`),

  /**
   * Dedicated pause/activate actions (A2-05): reversible, temporary — hidden from public search and new guest
   * bookings, but the property stays fully visible to its host and keeps its plan slot. Never fails on unrelated
   * fields (unlike a generic `update`).
   */
  pause: (id: string) => ApiClient.post<PropertyPauseStatus>(`/properties/${id}/pause`),
  activate: (id: string) => ApiClient.post<PropertyPauseStatus>(`/properties/${id}/activate`),

  search: (params: PropertySearchParams) => {
    const apiParams: Record<string, string | number | undefined> = {};
    if (params.city) apiParams.city = params.city;
    if (params.minBedrooms !== undefined) apiParams.bedrooms = params.minBedrooms;
    if (params.maxPrice !== undefined) apiParams.maxPrice = params.maxPrice;
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
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
    return response.data;
  },

  deleteDocument: (id: string, docId: string) =>
    ApiClient.delete<void>(`/properties/${id}/documents/${docId}`),

  /** Cadastral identification of the unit (LT-10): used by the lease contract. */
  updateCadastral: (id: string, data: PropertyCadastralData) =>
    ApiClient.put<void>(`/properties/${id}/cadastral`, data),

  /** Code and energy class printed on an APE document (LT-10): stated in the lease contract. */
  updateApeIdentification: (id: string, docId: string, data: ApeIdentification) =>
    ApiClient.put<PropertyDocumentDto>(`/properties/${id}/documents/${docId}/ape`, data),

  /**
   * Documents are in the private storage bucket: the file is fetched through the authenticated
   * endpoint (bearer token, tenant/ownership check), never through a public link.
   */
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
