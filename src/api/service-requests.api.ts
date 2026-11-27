import { ApiClient } from '@/api/client';
import axios from '@/lib/axios';
import type {
  CreateLongRentServiceRequestDto,
  CreateServiceRequestDto,
  InterventionCounts,
  InterventionFilterParams,
  InterventionListParams,
  ServicePaymentSession,
  ServiceRequest,
  ServiceRequestHostView,
  SendServiceRequestQuoteDto,
  ServiceRequestListResponse,
  SupplierListResponse,
  SupplierPicker,
  SupplierPickerSort,
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

export async function fetchInterventions(params: InterventionListParams): Promise<ServiceRequestListResponse> {
  return ApiClient.get<ServiceRequestListResponse>('/service-requests', params);
}

export async function fetchInterventionCounts(params: InterventionFilterParams): Promise<InterventionCounts> {
  return ApiClient.get<InterventionCounts>('/service-requests/counts', params);
}

export async function fetchIntervention(id: string): Promise<ServiceRequest> {
  return ApiClient.get<ServiceRequest>(`/service-requests/${encodeURIComponent(id)}`);
}

export async function remindServiceRequest(id: string): Promise<ServiceRequest> {
  const { data } = await axios.post<ServiceRequest>(`/service-requests/${encodeURIComponent(id)}/remind`);
  return data;
}

export async function acceptServiceRequestProposal(id: string): Promise<ServiceRequest> {
  const { data } = await axios.post<ServiceRequest>(`/service-requests/${encodeURIComponent(id)}/proposal/accept`);
  return data;
}

export async function rejectServiceRequestProposal(id: string): Promise<ServiceRequest> {
  const { data } = await axios.post<ServiceRequest>(`/service-requests/${encodeURIComponent(id)}/proposal/reject`);
  return data;
}

export async function confirmServiceRequestFinalAmount(id: string): Promise<ServiceRequest> {
  const { data } = await axios.post<ServiceRequest>(`/service-requests/${encodeURIComponent(id)}/final-amount/confirm`);
  return data;
}

export async function createServiceRequestPaymentSession(id: string): Promise<ServicePaymentSession> {
  const { data } = await axios.post<ServicePaymentSession>(`/service-requests/${encodeURIComponent(id)}/payment-session`);
  return data;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('The photo could not be read.'));
    reader.readAsDataURL(blob);
  });
}

export async function fetchServiceRequestPhoto(url: string): Promise<string> {
  const { data } = await axios.get<Blob>(url.replace(/^\/api(?=\/)/, ''), { responseType: 'blob' });
  return blobToDataUrl(data);
}

/** Short-rent request for the house, with a stay when the host names one (`bookingId` is optional since SR-08a). */
export async function createServiceRequest(payload: CreateServiceRequestDto): Promise<ServiceRequest> {
  const { data } = await axios.post<ServiceRequest>('/service-requests', payload);
  return data;
}

export async function takeServiceRequest(id: string): Promise<ServiceRequest> {
  const { data } = await axios.post<ServiceRequest>(`/service-requests/${id}/take`);
  return data;
}

export async function acceptServiceRequestAsBackup(id: string): Promise<ServiceRequest> {
  const { data } = await axios.post<ServiceRequest>(`/service-requests/${id}/accept-as-backup`);
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

export async function cancelServiceRequest(id: string, reason: string): Promise<ServiceRequest> {
  const { data } = await axios.post<ServiceRequest>(`/service-requests/${id}/cancel`, { reason });
  return data;
}

export async function markServiceRequestPaid(id: string): Promise<ServiceRequest> {
  const { data } = await axios.post<ServiceRequest>(`/service-requests/${id}/mark-paid`);
  return data;
}

export async function sendServiceRequestQuote(id: string, quote: SendServiceRequestQuoteDto): Promise<ServiceRequest> {
  const { data } = await axios.post<ServiceRequest>(`/service-requests/${id}/quote`, quote);
  return data;
}

export async function withdrawServiceRequestQuote(id: string): Promise<ServiceRequest> {
  const { data } = await axios.post<ServiceRequest>(`/service-requests/${id}/quote/withdraw`);
  return data;
}

export async function requestServiceRequestPayment(id: string): Promise<void> {
  await axios.post(`/supplier/requests/${id}/payment-request`);
}

export async function recordOfflineServiceRequestPayment(id: string, reason?: string): Promise<void> {
  await axios.post(`/supplier/requests/${id}/payment/offline`, reason ? { reason } : {});
}

export async function fetchSuppliersByProperty(propertyId: string, category?: string): Promise<SupplierListResponse> {
  return ApiClient.get<SupplierListResponse>('/suppliers', { propertyId, category, includeTrusted: true });
}

export async function fetchMarketplaceSuppliers(params: {
  includeTrusted?: boolean;
  propertyId?: string;
  accountScope?: boolean;
  category?: string;
  q?: string;
  sort?: SupplierPickerSort;
}): Promise<SupplierListResponse> {
  const { sort, ...rest } = params;
  return ApiClient.get<SupplierListResponse>('/suppliers', sort && sort !== 'recommended' ? { ...rest, sort } : rest);
}

export async function fetchMarketplaceSupplier(orgId: string): Promise<SupplierPicker> {
  return ApiClient.get<SupplierPicker>(`/suppliers/${encodeURIComponent(orgId)}`, { accountScope: true });
}

export async function fetchLongRentServiceRequests(params: {
  propertyId?: string;
  leaseId?: string;
  status?: string;
  view?: ServiceRequestHostView;
  page?: number;
  pageSize?: number;
}): Promise<ServiceRequestListResponse> {
  return ApiClient.get<ServiceRequestListResponse>('/long-rent/service-requests', params);
}

const LIST_PAGE_SIZE = 100;
const LIST_MAX_PAGES = 10;

export async function fetchAllLongRentServiceRequests(view?: ServiceRequestHostView): Promise<ServiceRequest[]> {
  const items: ServiceRequest[] = [];
  for (let page = 1; page <= LIST_MAX_PAGES; page += 1) {
    const answer = await fetchLongRentServiceRequests({ view, page, pageSize: LIST_PAGE_SIZE });
    items.push(...answer.items);
    if (answer.items.length === 0 || items.length >= answer.total) break;
  }
  return items;
}

export async function fetchLongRentServiceRequest(id: string): Promise<ServiceRequest> {
  return ApiClient.get<ServiceRequest>(`/long-rent/service-requests/${encodeURIComponent(id)}`);
}

export async function cancelLongRentServiceRequest(id: string, reason: string): Promise<ServiceRequest> {
  const { data } = await axios.post<ServiceRequest>(`/long-rent/service-requests/${encodeURIComponent(id)}/cancel`, { reason });
  return data;
}

export async function remindLongRentServiceRequest(id: string): Promise<ServiceRequest> {
  const { data } = await axios.post<ServiceRequest>(`/long-rent/service-requests/${encodeURIComponent(id)}/remind`);
  return data;
}

export async function acceptLongRentProposal(id: string): Promise<ServiceRequest> {
  const { data } = await axios.post<ServiceRequest>(`/long-rent/service-requests/${encodeURIComponent(id)}/proposal/accept`);
  return data;
}

export async function rejectLongRentProposal(id: string): Promise<ServiceRequest> {
  const { data } = await axios.post<ServiceRequest>(`/long-rent/service-requests/${encodeURIComponent(id)}/proposal/reject`);
  return data;
}

export async function confirmLongRentFinalAmount(id: string): Promise<ServiceRequest> {
  const { data } = await axios.post<ServiceRequest>(`/long-rent/service-requests/${encodeURIComponent(id)}/final-amount/confirm`);
  return data;
}

export async function createLongRentPaymentSession(id: string): Promise<ServicePaymentSession> {
  const { data } = await axios.post<ServicePaymentSession>(`/long-rent/service-requests/${encodeURIComponent(id)}/payment-session`);
  return data;
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
