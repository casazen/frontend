import type { SupplierServicePriceUnit } from './supplier-services';

export interface HostSupplierService {
  id: string;
  name: string;
  category: string;
  durationMinutes: number | null;
  priceFromCents: number | null;
  priceUnit: SupplierServicePriceUnit;
  requiresQuote: boolean;
  /** The price a request for this service starts with: the "from" price of a service priced per job; `null` otherwise. */
  estimatedAmountCents: number | null;
}

export interface HostSupplierServicesResponse {
  items: HostSupplierService[];
}

export interface HostSupplierSlot {
  startUtc: string;
  endUtc: string;
}

export interface HostSupplierSlotsResponse {
  serviceId: string;
  durationMinutes: number | null;
  from: string | null;
  to: string | null;
  slots: HostSupplierSlot[];
}
