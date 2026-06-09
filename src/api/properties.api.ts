import { ApiClient } from './client';
import axios from '@/lib/axios';
import type {
  Property,
  CreatePropertyDto,
  UpdatePropertyDto,
  PropertySearchParams,
  PropertyDocument,
  PropertyDetailDto,
  PropertyDocumentDto,
  PublicPropertyDto,
  PublicPropertyDetailDto,
} from '@/types';

export const propertiesApi = {
  getAll: (params?: Record<string, string | number | boolean | undefined>) =>
    ApiClient.get<Property[]>('/properties', params),

  getById: (id: string) => ApiClient.get<Property>(`/properties/${id}`),

  create: (data: CreatePropertyDto) =>
    ApiClient.post<Property>('/properties', data),

  update: (id: string, data: UpdatePropertyDto) =>
    ApiClient.put<Property>(`/properties/${id}`, data),

  delete: (id: string) => ApiClient.delete<void>(`/properties/${id}`),

  search: (params: PropertySearchParams) => {
    const apiParams: Record<string, string | number | undefined> = {};
    if (params.city) apiParams.city = params.city;
    if (params.minBedrooms !== undefined) apiParams.bedrooms = params.minBedrooms;
    if (params.maxPrice !== undefined) apiParams.maxPrice = params.maxPrice;
    return ApiClient.get<PublicPropertyDto[]>('/properties/search', apiParams);
  },

  getPublicProperty: (id: string) =>
    ApiClient.get<PublicPropertyDetailDto>(`/properties/${id}/public`),

  getDocuments: (id: string) =>
    ApiClient.get<PropertyDocument[]>(`/properties/${id}/documents`),

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
};
