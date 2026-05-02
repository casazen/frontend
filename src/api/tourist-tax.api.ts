import { apiClient } from './client';
import type {
  TouristTaxRate,
  CreateTouristTaxRateDto,
  UpdateTouristTaxRateDto,
  TouristTaxCalculationRequest,
  TouristTaxCalculationResponse,
} from '@/types';

export const touristTaxApi = {
  // GET /api/tourist-tax-rates
  async getAll(): Promise<TouristTaxRate[]> {
    const response = await apiClient.get<TouristTaxRate[]>('/tourist-tax-rates');
    return response.data;
  },

  // GET /api/tourist-tax-rates/{id}
  async getById(id: string): Promise<TouristTaxRate> {
    const response = await apiClient.get<TouristTaxRate>(`/tourist-tax-rates/${id}`);
    return response.data;
  },

  // GET /api/tourist-tax-rates/city/{city}
  async getByCity(city: string, date?: Date): Promise<TouristTaxRate> {
    const response = await apiClient.get<TouristTaxRate>(`/tourist-tax-rates/city/${city}`, {
      params: { date: date?.toISOString() },
    });
    return response.data;
  },

  // POST /api/tourist-tax-rates/calculate
  async calculate(request: TouristTaxCalculationRequest): Promise<TouristTaxCalculationResponse> {
    const response = await apiClient.post<TouristTaxCalculationResponse>(
      '/tourist-tax-rates/calculate',
      request
    );
    return response.data;
  },

  // POST /api/tourist-tax-rates (Admin only)
  async create(data: CreateTouristTaxRateDto): Promise<TouristTaxRate> {
    const response = await apiClient.post<TouristTaxRate>('/tourist-tax-rates', data);
    return response.data;
  },

  // PUT /api/tourist-tax-rates/{id} (Admin only)
  async update(id: string, data: UpdateTouristTaxRateDto): Promise<TouristTaxRate> {
    const response = await apiClient.put<TouristTaxRate>(`/tourist-tax-rates/${id}`, data);
    return response.data;
  },

  // DELETE /api/tourist-tax-rates/{id} (Admin only - soft delete)
  async delete(id: string): Promise<void> {
    await apiClient.delete(`/tourist-tax-rates/${id}`);
  },
};
