import { ApiClient } from '@/api/client';
import type { HostSupplierServicesResponse, HostSupplierSlotsResponse } from '@/types/host-supplier-catalog';

/**
 * The published services of a supplier for a property of the host (SR-08a): 404 `supplier_not_found`, 422
 * `service_request_supplier_inactive` or `service_request_supplier_outside_comune` when the supplier cannot be asked for that property.
 */
export async function fetchHostSupplierServices(supplierOrgId: string, params: { propertyId: string; category?: string }): Promise<HostSupplierServicesResponse> {
  return ApiClient.get<HostSupplierServicesResponse>(`/suppliers/${encodeURIComponent(supplierOrgId)}/services`, params);
}

/** The free slots of one service, from `date` (`yyyy-MM-dd`, Europe/Rome; today when missing) for 14 days at most. */
export async function fetchHostSupplierSlots(
  supplierOrgId: string,
  serviceId: string,
  params: { propertyId: string; date?: string },
): Promise<HostSupplierSlotsResponse> {
  return ApiClient.get<HostSupplierSlotsResponse>(`/suppliers/${encodeURIComponent(supplierOrgId)}/services/${encodeURIComponent(serviceId)}/slots`, params);
}
