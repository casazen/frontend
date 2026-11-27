import { ApiClient } from '@/api/client';
import type {
  SendSupplierOfferBody,
  SupplierOfferResponse,
  SupplierRequestMessage,
  SupplierRequestThread,
  SupplierServiceDispute,
} from '@/types/supplier-inquiry';

const requestUrl = (id: string) => `/supplier/requests/${encodeURIComponent(id)}`;

export async function fetchSupplierRequestThread(id: string): Promise<SupplierRequestThread> {
  return ApiClient.get<SupplierRequestThread>(`${requestUrl(id)}/thread`);
}

export async function postSupplierRequestMessage(id: string, body: string): Promise<SupplierRequestMessage> {
  return ApiClient.post<SupplierRequestMessage>(`${requestUrl(id)}/messages`, { body });
}

export async function sendSupplierOffer(id: string, body: SendSupplierOfferBody): Promise<SupplierOfferResponse> {
  return ApiClient.post<SupplierOfferResponse>(`${requestUrl(id)}/offer`, body);
}

export async function withdrawSupplierOffer(id: string): Promise<SupplierOfferResponse> {
  return ApiClient.post<SupplierOfferResponse>(`${requestUrl(id)}/offer/withdraw`);
}

export async function fetchSupplierDispute(id: string): Promise<SupplierServiceDispute> {
  return ApiClient.get<SupplierServiceDispute>(`${requestUrl(id)}/dispute`);
}

export async function replySupplierDispute(id: string, text: string): Promise<SupplierServiceDispute> {
  return ApiClient.post<SupplierServiceDispute>(`${requestUrl(id)}/dispute/reply`, { text });
}
