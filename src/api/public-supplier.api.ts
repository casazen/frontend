import { ApiClient } from './client';

/** One row of a list the supplier wrote; every member may be missing, a half-filled row is not shown. */
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

/** A job of the gallery; a before/after has both `beforeUrl` and `photoUrl`. */
export interface PublicShowcaseWork {
  photoUrl?: string | null;
  beforeUrl?: string | null;
  caption?: string | null;
  place?: string | null;
  alt?: string | null;
}

/** Which blocks of the home the supplier shows (the services and the final actions are always shown). */
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
  /** `acqua`, `scintilla`, `fresco` or `naturale`; missing: the style recommended for the trade. */
  style?: string | null;
  /** `moderno`, `editoriale` or `classico`; missing: the font of the style. */
  font?: string | null;
  /** `#RRGGBB` of the buttons, one white text reads on at 4.5:1 or more (the server checks it; the page checks it again). */
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
  /** "Prima che arriviamo". */
  prep?: string[];
  sections?: Partial<PublicShowcaseSections>;
}

/** What the platform vouches for, only what is measured or checked: no rating, no reviews, no insurance, no years. */
export interface PublicSupplierTrust {
  /** "Verificato": active profile, VAT number and a payments account that can take charges and payouts. */
  verified: boolean;
  /** The jobs done with CasaZen, a true count, present only from a few of them. */
  jobsDone?: number;
}

export type PublicSupplierPriceUnit = 'PerJob' | 'PerHour' | 'PerSet' | 'PerSquareMeter';

/** A published service of the supplier as the card of the page shows it (`GET /public/suppliers/{slug}` with the bookings flag on). */
export interface PublicSupplierService {
  /** Unique among the supplier's services: the last part of `/fornitori/{supplierSlug}/servizi/{slug}`. */
  slug: string;
  name: string;
  category: string;
  summary?: string | null;
  /** The "from" price in euro cents; null is "on quote". */
  priceFromCents: number | null;
  priceUnit: PublicSupplierPriceUnit;
  /** As the supplier declared it: false means nothing is promised, not "VAT excluded". */
  pricesIncludeVat: boolean;
  requiresQuote: boolean;
  durationMinutes: number | null;
  included: string[];
  excluded: string[];
  /** Absolute photo URLs in display order; the first is the cover. */
  photoUrls: string[];
  urgent: { enabled: boolean; surchargeCents: number };
  /** The first free slot (UTC); present only while the showcase takes bookings and the service has a free slot. */
  nextSlotUtc?: string | null;
}

/** What the public page `/fornitori/:slug` shows of a supplier (`GET /api/public/suppliers/{slug}`, SU-13, SP-09, SP-13a). */
export interface SupplierShowcaseDto {
  /** Null only in the owner's preview of a profile that has no public address yet. */
  slug: string | null;
  legalName: string;
  /** Service category codes (translated by the page). */
  categories: string[];
  /** The comuni by name. */
  comuni: string[];
  bio?: string | null;
  photoUrls: string[];
  /** The next 14 days (Europe/Rome) the supplier saved an availability for. */
  availability: { date: string; available: boolean }[];
  /** SP-09: the published services; missing (not empty) while the bookings flag is off. */
  services?: PublicSupplierService[];
  /** SP-09: the typical time to answer, in minutes, measured; missing until there are enough requests. */
  medianResponseMinutes?: number | null;
  /** SP-13a: the published content; missing until the supplier published something. */
  content?: PublicShowcaseContent;
  /** SP-13a: the supplier paused the showcase. */
  paused?: boolean;
  /** SP-13a: the showcase takes bookings now (published, not paused, payments on, account ready). False: read-only. */
  bookingsOpen?: boolean;
  trust?: PublicSupplierTrust;
  /** SP-13a: how long the supplier has to answer a booking, in minutes (its setting). */
  respondWithinMinutes?: number | null;
  acceptsOnlinePayments?: boolean;
  /** The version of the privacy notice a booking records. */
  privacyNoticeVersion?: string | null;
}

export type PublicQuoteOutcome = 'Estimate' | 'OnQuote' | 'OutsideArea';
export type PublicQuoteCoverage = 'Unknown' | 'Covered' | 'Outside';

export interface PublicQuoteRequestBody {
  service: string;
  quantity?: number;
  surfaceSqm?: number;
  options?: { code: string; quantity?: number }[];
  /** ISTAT code or name of the comune where the work is. */
  comune?: string;
  urgent?: boolean;
}

export interface PublicQuoteResponse {
  service: string;
  serviceName: string;
  currency: string;
  pricesIncludeVat: boolean;
  outcome: PublicQuoteOutcome;
  isEstimate: boolean;
  requiresQuote: boolean;
  totalCents: number | null;
  coverage: PublicQuoteCoverage;
}

export const publicSupplierApi = {
  /** Public supplier showcase (`/fornitori/:slug`); anonymous endpoint `GET /api/public/suppliers/{slug}`. */
  getShowcase: (slug: string) =>
    ApiClient.get<SupplierShowcaseDto>(`/public/suppliers/${encodeURIComponent(slug)}`, undefined, {
      public: true,
    }),

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
