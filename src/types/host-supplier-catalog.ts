import type { SupplierServicePriceUnit } from './supplier-services';

/**
 * What the host reads of a supplier to ask it for an intervention (`GET /api/suppliers/{id}/services` and `…/slots`, SR-08a): its
 * published services and the free slots of one of them, for a property of the host.
 */

/** A published service of a supplier, with the price a request for it starts with. */
export interface HostSupplierService {
  /** The `serviceListingId` of the request. */
  id: string;
  name: string;
  /** A code of `GET /api/service-categories`. */
  category: string;
  /** Indicative duration in minutes; `null` when the supplier gave none (the host then gives the time and the length). */
  durationMinutes: number | null;
  /** The "from" price in euro cents; `null` is "on quote". */
  priceFromCents: number | null;
  priceUnit: SupplierServicePriceUnit;
  /** The host waits for the supplier's offer: the price is confirmed before the work. */
  requiresQuote: boolean;
  /** The price a request for this service starts with: the "from" price of a service priced per job; `null` otherwise. */
  estimatedAmountCents: number | null;
}

export interface HostSupplierServicesResponse {
  items: HostSupplierService[];
}

/** One free slot: the work starts at `startUtc` and ends at `endUtc`. */
export interface HostSupplierSlot {
  startUtc: string;
  endUtc: string;
}

/**
 * The free slots of a service, in start order, for the Europe/Rome days `from` to `to` (14 days at most; both `null` when the first day
 * asked for is past the supplier's horizon, or when the service has no duration).
 */
export interface HostSupplierSlotsResponse {
  serviceId: string;
  /** How long the work lasts, in minutes; `null` when the service has no duration (then there is no slot). */
  durationMinutes: number | null;
  from: string | null;
  to: string | null;
  slots: HostSupplierSlot[];
}
