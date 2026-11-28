import { ApiClient } from './client';

export interface PublicShowcaseTeamMember {
  name?: string | null;
  role?: string | null;
}

export interface PublicShowcaseCertification {
  label?: string | null;
  detail?: string | null;
}

export interface PublicShowcaseFaq {
  q?: string | null;
  a?: string | null;
}

export interface PublicShowcaseWork {
  photoUrl?: string | null;
  beforeUrl?: string | null;
  caption?: string | null;
  place?: string | null;
  alt?: string | null;
}

export interface PublicShowcaseSections {
  trust: boolean;
  how: boolean;
  works: boolean;
  zones: boolean;
  certs: boolean;
  faq: boolean;
}

/**
 * The **published** content of a showcase (SP-13a, `schemaVersion` 1): plain text written by the supplier, never the draft and
 * never a contact (phone, e-mail, VAT number). Every member may be missing.
 */
export interface PublicShowcaseContent {
  style?: string | null;
  font?: string | null;
  color?: string | null;
  logo?: { mode?: string | null; url?: string | null } | null;
  cover?: { url?: string | null; alt?: string | null } | null;
  tagline?: string | null;
  intro?: string | null;
  bio?: string | null;
  team?: PublicShowcaseTeamMember[];
  values?: string[];
  guarantee?: { title?: string | null; text?: string | null } | null;
  certs?: PublicShowcaseCertification[];
  faq?: PublicShowcaseFaq[];
  gallery?: PublicShowcaseWork[];
  prep?: string[];
  sections?: Partial<PublicShowcaseSections>;
}

export interface PublicSupplierTrust {
  /** "Verificato": active profile, VAT number and a payments account that can take charges and payouts. */
  verified: boolean;
  jobsDone?: number;
}

export type PublicSupplierPriceUnit = 'PerJob' | 'PerHour' | 'PerSet' | 'PerSquareMeter';

export interface PublicSupplierService {
  slug: string;
  name: string;
  category: string;
  summary?: string | null;
  priceFromCents: number | null;
  priceUnit: PublicSupplierPriceUnit;
  /** As the supplier declared it: false means nothing is promised, not "VAT excluded". */
  pricesIncludeVat: boolean;
  requiresQuote: boolean;
  durationMinutes: number | null;
  included: string[];
  excluded: string[];
  photoUrls: string[];
  urgent: { enabled: boolean; surchargeCents: number };
  nextSlotUtc?: string | null;
}

export interface SupplierShowcaseDto {
  slug: string | null;
  legalName: string;
  categories: string[];
  comuni: string[];
  bio?: string | null;
  photoUrls: string[];
  availability: { date: string; available: boolean }[];
  services?: PublicSupplierService[];
  medianResponseMinutes?: number | null;
  content?: PublicShowcaseContent;
  paused?: boolean;
  bookingsOpen?: boolean;
  trust?: PublicSupplierTrust;
  respondWithinMinutes?: number | null;
  acceptsOnlinePayments?: boolean;
  privacyNoticeVersion?: string | null;
}

export type PublicQuoteOutcome = 'Estimate' | 'OnQuote' | 'OutsideArea';
export type PublicQuoteCoverage = 'Unknown' | 'Covered' | 'Outside';

export interface PublicQuoteRequestBody {
  service: string;
  quantity?: number;
  surfaceSqm?: number;
  options?: { code: string; quantity?: number }[];
  comune?: string;
  urgent?: boolean;
}

export interface PublicQuoteLine {
  kind: 'Base' | 'Supplement' | 'Urgent';
  code?: string | null;
  label: string;
  per?: string | null;
  quantity: number;
  unitAmountCents: number;
  amountCents: number;
}

export interface PublicQuoteResponse {
  service: string;
  serviceName: string;
  currency: string;
  pricesIncludeVat: boolean;
  outcome: PublicQuoteOutcome;
  reason?: string | null;
  isEstimate: boolean;
  requiresQuote: boolean;
  totalCents: number | null;
  lines: PublicQuoteLine[];
  coverage: PublicQuoteCoverage;
}

export type PublicSupplementUnit = 'flat' | 'bathroom' | 'sqm30' | 'set' | 'hour';

export interface PublicSupplierSupplement {
  code: string;
  label: string;
  amountCents: number;
  per: PublicSupplementUnit;
  max?: number | null;
  includedSqm?: number | null;
}

export interface PublicSupplierServiceDetail extends PublicSupplierService {
  description?: string | null;
  supplements: PublicSupplierSupplement[];
}

export interface PublicSlot {
  startUtc: string;
  endUtc: string;
  startLocal: string;
  endLocal: string;
}

export interface PublicSlotDay {
  date: string;
  available: boolean;
  slots: PublicSlot[];
}

export interface PublicSlotsResponse {
  service: string;
  durationMinutes: number;
  timeZone: string;
  bookableUntil: string;
  days: PublicSlotDay[];
}

export const publicSupplierApi = {
  getShowcase: (slug: string) =>
    ApiClient.get<SupplierShowcaseDto>(`/public/suppliers/${encodeURIComponent(slug)}`, undefined, {
      public: true,
    }),

  getService: (slug: string, serviceSlug: string) =>
    ApiClient.get<PublicSupplierServiceDetail>(
      `/public/suppliers/${encodeURIComponent(slug)}/services/${encodeURIComponent(serviceSlug)}`,
      undefined,
      { public: true },
    ),

  getSlots: (slug: string, params: { service: string; from?: string; days?: number; urgent?: boolean }) =>
    ApiClient.get<PublicSlotsResponse>(`/public/suppliers/${encodeURIComponent(slug)}/slots`, params, { public: true }),

  /**
   * The price estimate of a service for the options, the surface and the comune the customer chose (anonymous, 30 a minute
   * per IP). Always 200 for a request that fits the service: a service on quote and a comune outside the zones are answers
   * (`outcome`, `coverage`), not errors.
   */
  quote: (slug: string, body: PublicQuoteRequestBody) =>
    ApiClient.post<PublicQuoteResponse>(`/public/suppliers/${encodeURIComponent(slug)}/quote`, body, {
      public: true,
    }),
};
