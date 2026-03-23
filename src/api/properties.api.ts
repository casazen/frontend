import { ApiClient } from './client';
import type {
  Property,
  CreatePropertyDto,
  UpdatePropertyDto,
  PropertySearchParams,
} from '@/types';

export const propertiesApi = {
  getAll: (params?: Record<string, any>) =>
    ApiClient.getPaginated<Property>('/properties', params),

  getById: (id: string) => ApiClient.get<Property>(`/properties/${id}`),

  create: (data: CreatePropertyDto) =>
    ApiClient.post<Property>('/properties', data),

  update: (id: string, data: UpdatePropertyDto) =>
    ApiClient.patch<Property>(`/properties/${id}`, data),

  delete: (id: string) => ApiClient.delete<void>(`/properties/${id}`),

  search: (params: PropertySearchParams) =>
    ApiClient.getPaginated<Property>('/properties/search', params),
};
