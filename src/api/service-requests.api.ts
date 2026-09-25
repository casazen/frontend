import { ApiClient } from '@/api/client';
import axios from '@/lib/axios';
import type {
  CreateLongRentServiceRequestDto,
  CreateServiceRequestDto,
  ServiceRequest,
  ServiceRequestListResponse,
  SupplierListResponse,
} from '@/types/service-request';

/**
 * Short-rent requests (D2). The same filters as the app: `bookingId` for one stay (booking detail), `propertyId` for a
 * property (every stay, plus the older requests not traced to a stay).
 */
export async function fetchServiceRequests(params?: {
  propertyId?: string;
  bookingId?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}): Promise<ServiceRequestListResponse> {
  return ApiClient.get<ServiceRequestListResponse>('/service-requests', params);
}

export async function fetchServiceRequest(id: string): Promise<ServiceRequest> {
  return ApiClient.get<ServiceRequest>(`/service-requests/${id}`);
}

/** Short-rent request for a stay: the API answers 422 without a `bookingId` of the property. */
export async function createServiceRequest(payload: CreateServiceRequestDto): Promise<ServiceRequest> {
  const { data } = await axios.post<ServiceRequest>('/service-requests', payload);
  return data;
}

export async function takeServiceRequest(id: string): Promise<ServiceRequest> {
  const { data } = await axios.post<ServiceRequest>(`/service-requests/${id}/take`);
  return data;
}

export async function completeServiceRequest(id: string, notes?: string): Promise<ServiceRequest> {
  const { data } = await axios.post<ServiceRequest>(`/service-requests/${id}/complete`, { notes });
  return data;
}

export async function rejectServiceRequest(id: string, reason: string): Promise<ServiceRequest> {
  const { data } = await axios.post<ServiceRequest>(`/service-requests/${id}/reject`, { reason });
  return data;
}

export async function markServiceRequestPaid(id: string): Promise<ServiceRequest> {
  const { data } = await axios.post<ServiceRequest>(`/service-requests/${id}/mark-paid`);
  return data;
}

export async function fetchSuppliersByComune(comune: string, category?: string): Promise<SupplierListResponse> {
  return ApiClient.get<SupplierListResponse>('/suppliers', { comune, category });
}

export async function fetchSuppliersByProperty(propertyId: string, category?: string): Promise<SupplierListResponse> {
  return ApiClient.get<SupplierListResponse>('/suppliers', { propertyId, category });
}

// ─── Long-rent context (D2): requests for the property, `/long-rent/service-requests` ───

export async function fetchLongRentServiceRequests(params: {
  propertyId?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}): Promise<ServiceRequestListResponse> {
  return ApiClient.get<ServiceRequestListResponse>('/long-rent/service-requests', params);
}

export async function fetchLongRentSuppliers(propertyId: string, category?: string): Promise<SupplierListResponse> {
  return ApiClient.get<SupplierListResponse>('/long-rent/service-requests/suppliers', { propertyId, category });
}

export async function createLongRentServiceRequest(payload: CreateLongRentServiceRequestDto): Promise<ServiceRequest> {
  const { data } = await axios.post<ServiceRequest>('/long-rent/service-requests', payload);
  return data;
}

export async function markLongRentServiceRequestPaid(id: string): Promise<ServiceRequest> {
  const { data } = await axios.post<ServiceRequest>(`/long-rent/service-requests/${id}/mark-paid`);
  return data;
}
