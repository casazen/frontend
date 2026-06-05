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

  search: (params: PropertySearchParams) =>
    ApiClient.get<Property[]>('/properties/search', params),

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
