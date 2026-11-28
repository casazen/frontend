export const SUPPLIER_SERVICE_PRICE_UNITS = ['PerJob', 'PerHour', 'PerSet', 'PerSquareMeter'] as const;
export type SupplierServicePriceUnit = (typeof SUPPLIER_SERVICE_PRICE_UNITS)[number];

export const SUPPLIER_SERVICE_STATUSES = ['Draft', 'Active', 'Paused'] as const;
export type SupplierServiceStatus = (typeof SUPPLIER_SERVICE_STATUSES)[number];

export const SUPPLIER_SUPPLEMENT_UNITS = ['flat', 'bathroom', 'sqm30', 'set', 'hour'] as const;
export type SupplierSupplementUnit = (typeof SUPPLIER_SUPPLEMENT_UNITS)[number];

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

export interface SupplierServiceSupplement {
  code: string;
  label: string;
  amountCents: number;
  per: SupplierSupplementUnit;
  max?: number | null;
}

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
  photoUrls: string[];
  status: SupplierServiceStatus;
  sortOrder: number;
  publishable: boolean;
  missingForPublication: string[];
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface SupplierServiceList {
  items: SupplierService[];
  total: number;
  limit: number;
}

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
