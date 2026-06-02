import { ApiClient } from './client';
import type {
  Property,
  CreatePropertyDto,
  UpdatePropertyDto,
  PropertySearchParams,
  PropertyDocument,
} from '@/types';

export const propertiesApi = {
  getAll: (params?: Record<string, any>) =>
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
};
