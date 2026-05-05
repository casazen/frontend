import axios from '@/lib/axios';
import type { ApiResponse, PaginatedResponse } from '@/types';

/**
 * Unwraps API response data, handling both wrapped ({ data: T }) and
 * unwrapped (T) responses from the backend.
 *
 * The backend returns raw entities/arrays directly (not wrapped).
 * This helper exists for forward compatibility if the backend ever
 * adopts an envelope format like { data: T, message?: string }.
 */
function unwrap<T>(responseData: ApiResponse<T> | T): T {
  if (
    responseData !== null &&
    typeof responseData === 'object' &&
    !Array.isArray(responseData) &&
    'data' in responseData
  ) {
    return (responseData as ApiResponse<T>).data;
  }
  return responseData as T;
}

export class ApiClient {
  /**
   * GET request - handles both wrapped and unwrapped backend responses
   */
  static async get<T>(url: string, params?: Record<string, any>): Promise<T> {
    const response = await axios.get<ApiResponse<T> | T>(url, { params });
    return unwrap<T>(response.data as ApiResponse<T> | T);
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
   * POST request - handles both wrapped and unwrapped backend responses
   */
  static async post<T>(url: string, data?: any): Promise<T> {
    const response = await axios.post<ApiResponse<T> | T>(url, data);
    return unwrap<T>(response.data as ApiResponse<T> | T);
  }

  /**
   * PUT request - handles both wrapped and unwrapped backend responses
   */
  static async put<T>(url: string, data?: any): Promise<T> {
    const response = await axios.put<ApiResponse<T> | T>(url, data);
    return unwrap<T>(response.data as ApiResponse<T> | T);
  }

  /**
   * PATCH request - handles both wrapped and unwrapped backend responses
   */
  static async patch<T>(url: string, data?: any): Promise<T> {
    const response = await axios.patch<ApiResponse<T> | T>(url, data);
    return unwrap<T>(response.data as ApiResponse<T> | T);
  }

  /**
   * DELETE request - handles both wrapped and unwrapped backend responses
   */
  static async delete<T>(url: string): Promise<T> {
    const response = await axios.delete<ApiResponse<T> | T>(url);
    return unwrap<T>(response.data as ApiResponse<T> | T);
  }
}
