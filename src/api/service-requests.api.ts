import { ApiClient } from '@/api/client';
import axios from '@/lib/axios';
import type {
  CreateServiceRequestDto,
  ServiceRequest,
  ServiceRequestListResponse,
  SupplierListResponse,
} from '@/types/service-request';

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
