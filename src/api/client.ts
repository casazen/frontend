import axios from '@/lib/axios';
import type { ApiResponse, PaginatedResponse } from '@/types';

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

type QueryParams = object;

export interface ApiRequestOptions {
  public?: boolean;
  localAuthRecovery?: boolean;
  /**
   * Extra request headers. The anonymous endpoints that carry a credential of their own use it (the guest area sends the
   * token of its session as `Authorization: Bearer`, see `guest-session.api.ts`), and the call that records a payment sends its
   * `Idempotency-Key`; the access token of a signed-in user is attached by the interceptor and is never passed here.
   */
  headers?: Record<string, string>;
  signal?: AbortSignal;
  timeout?: number;
}

export class ApiClient {
  static async get<T>(url: string, params?: QueryParams, options?: ApiRequestOptions): Promise<T> {
    const response = await axios.get<ApiResponse<T> | T>(url, { params, ...options });
    return unwrap<T>(response.data as ApiResponse<T> | T);
  }

  static async getPaginated<T>(
    url: string,
    params?: QueryParams,
    options?: ApiRequestOptions,
  ): Promise<PaginatedResponse<T>> {
    const response = await axios.get<PaginatedResponse<T>>(url, { params, ...options });
    return response.data;
  }

  static async post<T>(url: string, data?: unknown, options?: ApiRequestOptions): Promise<T> {
    const response = await axios.post<ApiResponse<T> | T>(url, data, options);
    return unwrap<T>(response.data as ApiResponse<T> | T);
  }

  static async put<T>(url: string, data?: unknown, options?: ApiRequestOptions): Promise<T> {
    const response = await axios.put<ApiResponse<T> | T>(url, data, options);
    return unwrap<T>(response.data as ApiResponse<T> | T);
  }

  static async patch<T>(url: string, data?: unknown, options?: ApiRequestOptions): Promise<T> {
    const response = await axios.patch<ApiResponse<T> | T>(url, data, options);
    return unwrap<T>(response.data as ApiResponse<T> | T);
  }

  static async delete<T>(url: string, options?: ApiRequestOptions): Promise<T> {
    const response = await axios.delete<ApiResponse<T> | T>(url, options);
    return unwrap<T>(response.data as ApiResponse<T> | T);
  }
}
