import { ApiClient } from '@/api/client';
import type { SupplierClientDetail, SupplierClientsResponse } from '@/types/supplier-clients';

const SUPPLIER_CLIENTS_PAGE_SIZE = 200;

/** The customers of the supplier, the one with the latest activity first. The answer carries personal data: it is never cached by the browser. */
export async function fetchSupplierClients(): Promise<SupplierClientsResponse> {
  return ApiClient.get<SupplierClientsResponse>('/supplier/clients', { filter: 'tutti', page: 1, pageSize: SUPPLIER_CLIENTS_PAGE_SIZE });
}

export async function fetchSupplierClient(id: string): Promise<SupplierClientDetail> {
  return ApiClient.get<SupplierClientDetail>(`/supplier/clients/${encodeURIComponent(id)}`);
}
