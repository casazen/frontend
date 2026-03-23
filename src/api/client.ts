import axios from '@/lib/axios';
import type { ApiResponse, PaginatedResponse } from '@/types';

export class ApiClient {
  /**
   * GET request
   */
  static async get<T>(url: string, params?: Record<string, any>): Promise<T> {
    const response = await axios.get<ApiResponse<T>>(url, { params });
    return response.data.data;
  }

  /**
   * GET paginated request
   */
  static async getPaginated<T>(
    url: string,
    params?: Record<string, any>
  ): Promise<PaginatedResponse<T>> {
    const response = await axios.get<PaginatedResponse<T>>(url, { params });
    return response.data;
  }

  /**
   * POST request
   */
  static async post<T>(url: string, data?: any): Promise<T> {
    const response = await axios.post<ApiResponse<T>>(url, data);
    return response.data.data;
  }

  /**
   * PUT request
   */
  static async put<T>(url: string, data?: any): Promise<T> {
    const response = await axios.put<ApiResponse<T>>(url, data);
    return response.data.data;
  }

  /**
   * PATCH request
   */
  static async patch<T>(url: string, data?: any): Promise<T> {
    const response = await axios.patch<ApiResponse<T>>(url, data);
    return response.data.data;
  }

  /**
   * DELETE request
   */
  static async delete<T>(url: string): Promise<T> {
    const response = await axios.delete<ApiResponse<T>>(url);
    return response.data.data;
  }
}
