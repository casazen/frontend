import { ApiClient } from '@/api/client';
import axios from '@/lib/axios';
import type {
  CreateLongRentServiceRequestDto,
  CreateServiceRequestDto,
  ServicePaymentSession,
  ServiceRequest,
  ServiceRequestHostView,
  SendServiceRequestQuoteDto,
  ServiceRequestListResponse,
  SupplierListResponse,
  SupplierPickerSort,
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

/** The supplier cancels a job it took, before it starts: the reason is required (500 characters at most) and the other party sees it. */
export async function cancelServiceRequest(id: string, reason: string): Promise<ServiceRequest> {
  const { data } = await axios.post<ServiceRequest>(`/service-requests/${id}/cancel`, { reason });
  return data;
}

export async function markServiceRequestPaid(id: string): Promise<ServiceRequest> {
  const { data } = await axios.post<ServiceRequest>(`/service-requests/${id}/mark-paid`);
  return data;
}

/**
 * The supplier answers a new request with a quote (SP-04b): 1 to 20 lines, a note and, optionally, another time. The request stays new and
 * waits for the customer; a new quote replaces the one that waits (and a proposed time), and holds no slot.
 */
export async function sendServiceRequestQuote(id: string, quote: SendServiceRequestQuoteDto): Promise<ServiceRequest> {
  const { data } = await axios.post<ServiceRequest>(`/service-requests/${id}/quote`, quote);
  return data;
}

/** The supplier takes its quote back: the request is «da rispondere» again (422 `service_request_no_quote` when none waits). */
export async function withdrawServiceRequestQuote(id: string): Promise<ServiceRequest> {
  const { data } = await axios.post<ServiceRequest>(`/service-requests/${id}/quote/withdraw`);
  return data;
}

/**
 * The supplier asks the payer for the payment of a completed job paid inside CasaZen, or reminds them (SP-15a): the payer gets a new link by
 * e-mail, one a day at most. Behind the `SupplierOnlinePayments` flag of the server (404 while it is off).
 */
export async function requestServiceRequestPayment(id: string): Promise<void> {
  await axios.post(`/supplier/requests/${id}/payment-request`);
}

/**
 * The supplier records that the job was paid outside CasaZen (SP-15a): the request becomes paid, with no commission, and the host is told.
 * A request paid inside CasaZen needs the `reason` (422 `service_payment_offline_reason_required`). Not behind the flag.
 */
export async function recordOfflineServiceRequestPayment(id: string, reason?: string): Promise<void> {
  await axios.post(`/supplier/requests/${id}/payment/offline`, reason ? { reason } : {});
}

export async function fetchSuppliersByProperty(propertyId: string, category?: string): Promise<SupplierListResponse> {
  return ApiClient.get<SupplierListResponse>('/suppliers', { propertyId, category });
}

/**
 * The suppliers of the marketplace (SR-09a): the same endpoint, with the words to look for (`q`: the name or the category code)
 * and the order (`sort`). Each supplier comes with its services, "from" price, measured response time and «Verificato».
 */
export async function fetchMarketplaceSuppliers(params: {
  propertyId: string;
  category?: string;
  q?: string;
  sort?: SupplierPickerSort;
}): Promise<SupplierListResponse> {
  return ApiClient.get<SupplierListResponse>('/suppliers', params);
}

// ─── Long-rent context (D2): requests for the property, `/long-rent/service-requests` ───

export async function fetchLongRentServiceRequests(params: {
  propertyId?: string;
  status?: string;
  /** `open` or `closed` (LR-08a); without it, every request. */
  view?: ServiceRequestHostView;
  page?: number;
  pageSize?: number;
}): Promise<ServiceRequestListResponse> {
  return ApiClient.get<ServiceRequestListResponse>('/long-rent/service-requests', params);
}

/** A page of the list holds at most this many requests (the API clamps `pageSize` to 100). */
const LIST_PAGE_SIZE = 100;
/** The list stops here, whatever the API says: a landlord with 1,000 requests would not read them in a list anyway. */
const LIST_MAX_PAGES = 10;

/** Every long-rent request of the caller's scope (newest first), page after page, for a list that searches and sorts them itself. */
export async function fetchAllLongRentServiceRequests(view?: ServiceRequestHostView): Promise<ServiceRequest[]> {
  const items: ServiceRequest[] = [];
  for (let page = 1; page <= LIST_MAX_PAGES; page += 1) {
    const answer = await fetchLongRentServiceRequests({ view, page, pageSize: LIST_PAGE_SIZE });
    items.push(...answer.items);
    if (answer.items.length === 0 || items.length >= answer.total) break;
  }
  return items;
}

/** One long-rent request (LR-08a): 404 `service_request_not_found` for one outside the caller's scope. */
export async function fetchLongRentServiceRequest(id: string): Promise<ServiceRequest> {
  return ApiClient.get<ServiceRequest>(`/long-rent/service-requests/${encodeURIComponent(id)}`);
}

/** The landlord cancels a request up to the work in progress; the reason is required (500 characters at most) and the supplier is told. */
export async function cancelLongRentServiceRequest(id: string, reason: string): Promise<ServiceRequest> {
  const { data } = await axios.post<ServiceRequest>(`/long-rent/service-requests/${encodeURIComponent(id)}/cancel`, { reason });
  return data;
}

/** The landlord reminds the supplier to answer a new request (at most one reminder every few hours: the API says when it is too soon). */
export async function remindLongRentServiceRequest(id: string): Promise<ServiceRequest> {
  const { data } = await axios.post<ServiceRequest>(`/long-rent/service-requests/${encodeURIComponent(id)}/remind`);
  return data;
}

/** The landlord accepts the time the supplier proposed: the request is taken. */
export async function acceptLongRentProposal(id: string): Promise<ServiceRequest> {
  const { data } = await axios.post<ServiceRequest>(`/long-rent/service-requests/${encodeURIComponent(id)}/proposal/accept`);
  return data;
}

/** The landlord turns the proposed time down: the request stays new and waits for another answer. */
export async function rejectLongRentProposal(id: string): Promise<ServiceRequest> {
  const { data } = await axios.post<ServiceRequest>(`/long-rent/service-requests/${encodeURIComponent(id)}/proposal/reject`);
  return data;
}

/** The landlord confirms a final amount that is above the quote by more than the tolerance (decision D7): only then it can be paid. */
export async function confirmLongRentFinalAmount(id: string): Promise<ServiceRequest> {
  const { data } = await axios.post<ServiceRequest>(`/long-rent/service-requests/${encodeURIComponent(id)}/final-amount/confirm`);
  return data;
}

/** The PaymentIntent the landlord confirms with the Stripe Payment Element to pay a request paid inside CasaZen. */
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
