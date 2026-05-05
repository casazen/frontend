import { ApiClient } from './client';
import type {
  TouristTaxRate,
  CreateTouristTaxRateDto,
  UpdateTouristTaxRateDto,
  TouristTaxCalculationRequest,
  TouristTaxCalculationResponse,
} from '@/types';

export const touristTaxApi = {
  // GET /api/tourist-tax-rates
  getAll: () =>
    ApiClient.get<TouristTaxRate[]>('/tourist-tax-rates'),

  // GET /api/tourist-tax-rates/{id}
  getById: (id: string) =>
    ApiClient.get<TouristTaxRate>(`/tourist-tax-rates/${id}`),

  // GET /api/tourist-tax-rates/city/{city}
  getByCity: (city: string, date?: Date) =>
    ApiClient.get<TouristTaxRate>(`/tourist-tax-rates/city/${city}`, date ? { date: date.toISOString() } : undefined),

  // POST /api/tourist-tax-rates/calculate
  calculate: (request: TouristTaxCalculationRequest) =>
    ApiClient.post<TouristTaxCalculationResponse>('/tourist-tax-rates/calculate', request),

  // POST /api/tourist-tax-rates (Admin only)
  create: (data: CreateTouristTaxRateDto) =>
    ApiClient.post<TouristTaxRate>('/tourist-tax-rates', data),

  // PUT /api/tourist-tax-rates/{id} (Admin only)
  update: (id: string, data: UpdateTouristTaxRateDto) =>
    ApiClient.put<TouristTaxRate>(`/tourist-tax-rates/${id}`, data),

  // DELETE /api/tourist-tax-rates/{id} (Admin only - soft delete)
  delete: (id: string) =>
    ApiClient.delete<void>(`/tourist-tax-rates/${id}`),
};
