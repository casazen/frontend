import { ApiClient } from '@/api/client';
import type {
  SendSupplierOfferBody,
  SupplierOfferResponse,
  SupplierRequestMessage,
  SupplierRequestThread,
  SupplierServiceDispute,
} from '@/types/supplier-inquiry';

const requestUrl = (id: string) => `/supplier/requests/${encodeURIComponent(id)}`;

/**
 * The conversation of a request on measure, in the order it was written, with whether the supplier may write and send an offer (SP-10b).
 * Reading it marks the customer's messages as read. 404 for any request that is not a request on measure of this supplier.
 */
export async function fetchSupplierRequestThread(id: string): Promise<SupplierRequestThread> {
  return ApiClient.get<SupplierRequestThread>(`${requestUrl(id)}/thread`);
}

/** A message of the supplier, 1 to 1000 characters of plain text. The first one stops the hour the supplier has to answer; the customer is told by e-mail, never with the words. */
export async function postSupplierRequestMessage(id: string, body: string): Promise<SupplierRequestMessage> {
  return ApiClient.post<SupplierRequestMessage>(`${requestUrl(id)}/messages`, { body });
}

/**
 * Answers a new request on measure with an offer (SP-10b-b): the lines, the time and a note. A new offer replaces the one that waits; the time
 * is judged by the agenda (409 `supplier_slot_unavailable` / `supplier_commitment_conflict`) but not held. The customer is told by e-mail.
 */
export async function sendSupplierOffer(id: string, body: SendSupplierOfferBody): Promise<SupplierOfferResponse> {
  return ApiClient.post<SupplierOfferResponse>(`${requestUrl(id)}/offer`, body);
}

/** Takes the offer back: the request stays new and the conversation goes on (422 `service_request_no_offer` when none waits). */
export async function withdrawSupplierOffer(id: string): Promise<SupplierOfferResponse> {
  return ApiClient.post<SupplierOfferResponse>(`${requestUrl(id)}/offer/withdraw`);
}

/** The complaint against the supplier about this job (SP-15c-c). 404 `service_dispute_not_found` when there is none. */
export async function fetchSupplierDispute(id: string): Promise<SupplierServiceDispute> {
  return ApiClient.get<SupplierServiceDispute>(`${requestUrl(id)}/dispute`);
}

/** The supplier's one reply to the complaint, in its own words (at most 1000 characters). The dispute goes to the CasaZen team to decide. */
export async function replySupplierDispute(id: string, text: string): Promise<SupplierServiceDispute> {
  return ApiClient.post<SupplierServiceDispute>(`${requestUrl(id)}/dispute/reply`, { text });
}
