import { ApiClient } from './client';
import type {
  Property,
  CreatePropertyDto,
  UpdatePropertyDto,
  PropertySearchParams,
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

  search: async (params: PropertySearchParams) => {
    // Backend returns array directly, not wrapped in ApiResponse
    const response = await axios.get<Property[]>('/properties/search', { params });
    return response.data;
  },
};
