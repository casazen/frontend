/**
 * The supplier's catalog of services with prices (SP-02, `api/supplier/services`). The names of the fields are the ones of
 * the API (the public showcase reads the same DTO, SP-09): they are never renamed here.
 */

/** What the price is for (`SupplierServicePriceUnit`). */
export const SUPPLIER_SERVICE_PRICE_UNITS = ['PerJob', 'PerHour', 'PerSet', 'PerSquareMeter'] as const;
export type SupplierServicePriceUnit = (typeof SUPPLIER_SERVICE_PRICE_UNITS)[number];

/** Lifecycle of a service (`SupplierServiceListingStatus`): a draft is never public, it never goes back to being one. */
export const SUPPLIER_SERVICE_STATUSES = ['Draft', 'Active', 'Paused'] as const;
export type SupplierServiceStatus = (typeof SUPPLIER_SERVICE_STATUSES)[number];

/** What one unit of a supplement is (`SupplierServiceSupplementUnits`). */
export const SUPPLIER_SUPPLEMENT_UNITS = ['flat', 'bathroom', 'sqm30', 'set', 'hour'] as const;
export type SupplierSupplementUnit = (typeof SUPPLIER_SUPPLEMENT_UNITS)[number];

/** `DayOfWeek` as the API sends it, Monday first. */
export const SUPPLIER_SERVICE_WEEKDAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const;
export type SupplierServiceWeekday = (typeof SUPPLIER_SERVICE_WEEKDAYS)[number];

/** A supplement in the structured form the estimate of the booking uses. `max` is the most units a customer can pick. */
export interface SupplierServiceSupplement {
  code: string;
  label: string;
  amountCents: number;
  per: SupplierSupplementUnit;
  max?: number | null;
}

/** A service of the catalog (`SupplierServiceDto`). */
export interface SupplierService {
  id: string;
  slug: string;
  name: string;
  category: string;
  summary: string | null;
  description: string | null;
  priceFromCents: number | null;
  priceUnit: SupplierServicePriceUnit;
  pricesIncludeVat: boolean;
  requiresQuote: boolean;
  durationMinutes: number | null;
  minNoticeHours: number | null;
  weekdays: SupplierServiceWeekday[];
  supplements: SupplierServiceSupplement[];
  included: string[];
  excluded: string[];
  /** Absolute URLs in display order; the first is the cover. */
  photoUrls: string[];
  status: SupplierServiceStatus;
  sortOrder: number;
  publishable: boolean;
  /** What a service that is not publishable lacks: `name`, `category`, `durationMinutes`, `priceFromCents`. */
  missingForPublication: string[];
  createdAt: string;
  updatedAt: string;
  /** To send back with the next `PUT`; every answer that changes the service carries the new one. */
  version: number;
}

/** `GET api/supplier/services`: the services that are not deleted, and how many a supplier can have. */
export interface SupplierServiceList {
  items: SupplierService[];
  total: number;
  limit: number;
}

/**
 * Body of `POST api/supplier/services` and, with `version`, of `PUT api/supplier/services/{id}`: a replacement, so every
 * field is sent. `photoUrls` is only for `PUT` (the photos to keep, in the new order); left out it keeps them as they are.
 */
export interface SaveSupplierServiceBody {
  name: string;
  category: string;
  summary: string | null;
  description: string | null;
  priceFromCents: number | null;
  priceUnit: SupplierServicePriceUnit;
  pricesIncludeVat: boolean;
  requiresQuote: boolean;
  durationMinutes: number | null;
  minNoticeHours: number | null;
  weekdays: SupplierServiceWeekday[];
  supplements: SupplierServiceSupplement[];
  included: string[];
  excluded: string[];
  photoUrls?: string[];
}

export interface UpdateSupplierServiceBody extends SaveSupplierServiceBody {
  version: number;
}
