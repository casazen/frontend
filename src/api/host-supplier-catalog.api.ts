import { ApiClient } from '@/api/client';
import type { HostSupplierServicesResponse, HostSupplierSlotsResponse } from '@/types/host-supplier-catalog';

export async function fetchHostSupplierServices(supplierOrgId: string, params: { propertyId: string; category?: string }): Promise<HostSupplierServicesResponse> {
  return ApiClient.get<HostSupplierServicesResponse>(`/suppliers/${encodeURIComponent(supplierOrgId)}/services`, params);
}

export async function fetchHostSupplierSlots(
  supplierOrgId: string,
  serviceId: string,
  params: { propertyId: string; date?: string },
): Promise<HostSupplierSlotsResponse> {
  return ApiClient.get<HostSupplierSlotsResponse>(`/suppliers/${encodeURIComponent(supplierOrgId)}/services/${encodeURIComponent(serviceId)}/slots`, params);
}
