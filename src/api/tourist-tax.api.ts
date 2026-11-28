import { ApiClient } from './client';
import type {
  TouristTaxRate,
  CreateTouristTaxRateDto,
  UpdateTouristTaxRateDto,
} from '@/types';

export const touristTaxApi = {
  getAll: () =>
    ApiClient.get<TouristTaxRate[]>('/tourist-tax-rates'),

  getById: (id: string) =>
    ApiClient.get<TouristTaxRate>(`/tourist-tax-rates/${id}`),

  getByCity: (city: string, date?: string) =>
    ApiClient.get<TouristTaxRate>(`/tourist-tax-rates/city/${city}`, date ? { date } : undefined),

  create: (data: CreateTouristTaxRateDto) =>
    ApiClient.post<TouristTaxRate>('/tourist-tax-rates', data),

  update: (id: string, data: UpdateTouristTaxRateDto) =>
    ApiClient.put<TouristTaxRate>(`/tourist-tax-rates/${id}`, data),

  delete: (id: string) =>
    ApiClient.delete<void>(`/tourist-tax-rates/${id}`),
};
