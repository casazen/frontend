import type { TouristTaxQuoteStatus, TouristTaxRateRule } from './tourist-tax.types';

export type SeoPageType = 'ComplianceGuide' | 'TouristTaxCalc' | 'SupplierMicrosite';
export type LegalReviewStatus = 'Draft' | 'Reviewed';

export interface SeoCta {
  /**
   * `/signup` of the web app with the comune and the default UTM parameters, on the public domain (backend
   * `App__PublicSiteBaseUrl`; relative only when that is not configured). SE-03.
   */
  signupUrl: string;
}

/** A rate of the comune in force today, as shown on the public page (one per category or season). */
export interface PublicTouristTaxRateSummary extends TouristTaxRateRule {
  city: string;
  accommodationCategory: string | null;
  effectiveFrom: string;
  effectiveTo: string | null;
  sourceUrl: string | null;
}

export interface SeoPagePublic {
  id: string;
  pageType: SeoPageType;
  title: string;
  metaDescription: string;
  bodyHtml: string;
  comuneName: string;
  comuneCode: string;
  regionCode: string;
  regionSlug: string;
  comuneSlug: string;
  /** On the configured public domain (backend `App__PublicSiteBaseUrl`); null only when it is not configured. */
  canonicalUrl: string | null;
  lastRefreshedAt: string | null;
  /**
   * The text was written by an AI model (then approved by an admin): the page shows the AI Act transparency notice next
   * to it (SE-05, A8-27). The disclaimers ("not legal advice", the notice) are texts of this app in the visitor's
   * language (`publicSeo.disclaimers.*`, `aiContentNotice.*`), not of the API (A8-19).
   */
  aiGenerated: boolean;
  /** Language of `title`, `metaDescription` and `bodyHtml` (`it`): the regulations are Italian. */
  contentLanguage: string;
  cta: SeoCta;
  /** Rates in force today; empty when CasaZen has no rate for the comune (A8-12). */
  touristTaxRates: PublicTouristTaxRateSummary[];
}

/** A page listed by the public hub `/p/affitti-brevi`: the same pages as the sitemap. */
export interface SeoPublishedPage {
  pageType: SeoPageType;
  title: string;
  comuneName: string;
  regionSlug: string;
  comuneSlug: string;
  /** Route of the page in this app (`/p/...`). */
  path: string;
}

export interface SeoPublishedPages {
  /** Canonical URL of the hub on the public domain; null only when the backend has no public URL configured. */
  canonicalUrl: string | null;
  pages: SeoPublishedPage[];
}

export interface PublicTouristTaxCalculateRequest {
  comuneSlug: string;
  numberOfAdults: number;
  numberOfChildren: number;
  checkInDate: string;
  checkOutDate: string;
  childrenAges?: number[];
  accommodationCategory?: string;
  nightlyPrice?: number;
}

export interface PublicTouristTaxCalculateResponse {
  comuneSlug: string;
  city: string;
  status: TouristTaxQuoteStatus;
  /** Only when `status` is `Calculated`. */
  taxAmount: number | null;
  numberOfAdults: number;
  numberOfChildren: number;
  nights: number;
  taxableNights: number;
  ageRulesApply: boolean;
  categories: string[];
  checkInDate: string;
  checkOutDate: string;
}

/**
 * What a stored revision holds (SE-01). Only `Generated` can be approved; the others are explicit "content not
 * generated" states (no AI provider configured, empty or invalid answer, old stub text withdrawn by the migration).
 */
export type SeoContentStatus =
  | 'Generated'
  | 'AiProviderNotConfigured'
  | 'EmptyOutput'
  | 'InvalidOutput'
  | 'Placeholder';

export type SeoReviewAction = 'Approved' | 'Withdrawn';

export interface SeoRevisionAdmin {
  id: string;
  generatedAt: string;
  aiModelTier: string;
  promptTokens: number;
  sourceDataVersion: string;
  contentStatus: SeoContentStatus;
  promptVersion: string | null;
}

/** An entry of the review audit: who approved or withdrew which revision, when, with which note. */
export interface SeoReviewEvent {
  action: SeoReviewAction;
  revisionId: string | null;
  actorUserId: string;
  occurredAt: string;
  counselApproved: boolean;
  note: string | null;
}

export interface SeoPageAdmin {
  id: string;
  slug: string;
  comuneCode: string;
  comuneName: string;
  regionCode: string;
  regionSlug: string;
  pageType: SeoPageType;
  title: string;
  /** Review state of the latest revision: `Reviewed` when it is the published one. */
  legalReviewStatus: LegalReviewStatus;
  publishedAt: string | null;
  lastRefreshedAt: string | null;
  latestRevision: SeoRevisionAdmin | null;
  publishedRevisionId: string | null;
  /** The public sees `publishedRevisionId`; false: the page is not on the public site nor in the sitemap. */
  isPublished: boolean;
  /** The latest revision is not the published one and waits for a review. */
  hasPendingRevision: boolean;
  /** One of the first pages: the approval needs the legal review confirmation. */
  counselRequired: boolean;
  /** Route of the public page in this app (`/p/...`); null for a comune the backend does not know. */
  publicPath: string | null;
  /** Absolute URL on the public domain; null when the backend has no public URL configured. */
  publicUrl: string | null;
  lastReviewEvent: SeoReviewEvent | null;
}

/** A revision with its text, already sanitized by the backend (FD-15 allowlist). */
export interface SeoRevisionPreview {
  id: string;
  generatedAt: string;
  contentStatus: SeoContentStatus;
  promptVersion: string | null;
  sourceDataVersion: string;
  bodyHtml: string;
}

export interface SeoPageAdminDetail {
  page: SeoPageAdmin;
  publishedRevision: SeoRevisionPreview | null;
  /** The text waiting for a review; null when the latest revision is the published one. */
  pendingRevision: SeoRevisionPreview | null;
  /** Newest first. */
  reviewHistory: SeoReviewEvent[];
}

export interface SeoPagesPagedResult {
  items: SeoPageAdmin[];
  totalCount: number;
  page: number;
  pageSize: number;
}

/** Every generated text is a draft waiting for a review: there is no automatic approval (SE-01). */
export interface SeoGenerateRequest {
  comuneCodes: string[];
  pageTypes?: SeoPageType[];
  forceRegenerate?: boolean;
}

export interface SeoComuneRegistryItem {
  code: string;
  name: string;
  regionSlug: string;
  comuneSlug: string;
}

export interface SeoGenerateAccepted {
  jobId: string;
  enqueuedAt: string;
  comuneCount: number;
  estimatedPages: number;
}

export interface PlatformAiBudget {
  monthlyTokenCap: number;
  tokensUsedThisMonth: number;
  lastResetAt: string;
}

/** Approval of the revision the admin read; `counselApproved` is the explicit legal review confirmation. */
export interface ApproveSeoRevisionRequest {
  revisionId: string;
  counselApproved: boolean;
  note?: string;
}

export interface WithdrawSeoPageRequest {
  note?: string;
}

export interface SeoPagesQuery {
  legalReviewStatus?: LegalReviewStatus;
  pageType?: SeoPageType;
  comuneCode?: string;
  page?: number;
  pageSize?: number;
}

// ─── Funnel analytics and featured properties (SE-04, #300 AC2 AC3 AC8 AC9) ────────────────────────────────

/**
 * Events of the SEO funnel sent to `POST /api/public/seo/events` (AC3): the click on the "Pubblica la tua casa" CTA
 * of a page and the start of the signup that came from it. Names of the wire format.
 */
export type SeoEventName = 'cta_click' | 'signup_start';

/**
 * Body of `POST /api/public/seo/events`: no personal data (no IP, no user id, no visitor id): the event, the comune of
 * the page (slug or ISTAT code) and the marketing values of the visit, validated with the rules of the signup
 * attribution (`src/lib/signup-attribution.ts`).
 */
export interface SeoEventPayload {
  event: SeoEventName;
  comuneSlug: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  /** Host of the site the visitor came from, never the URL. */
  referrerHost?: string;
}

/** A bookable property of a comune, as listed on its SEO pages (AC2). */
export interface FeaturedProperty {
  id: string;
  /** Property slug of the booking site; null for a legacy property (the booking path then uses the id). */
  slug: string | null;
  /** Current slug of the org: with the property it builds `/book/{orgSlug}/property/{slug}`. */
  orgSlug: string;
  name: string;
  city: string;
  bedrooms: number;
  bathrooms: number;
  maxGuests: number;
  nightlyRate: number;
  /** First photo, an absolute URL; null when the property has none. */
  photoUrl: string | null;
}

/** `GET /api/public/seo/{comune}/featured-properties`: published properties of the comune (never paused or pending). */
export interface FeaturedPropertiesResponse {
  comuneSlug: string;
  comuneName: string;
  properties: FeaturedProperty[];
}

/** A row of the admin widget: what one comune did in the window. */
export interface SeoTopComune {
  comuneCode: string;
  comuneName: string;
  /** `cta_click` events. */
  ctaClicks: number;
  /** `signup_start` events. */
  signupStarts: number;
  /** Host signups attributed to the comune (`SignupAttribution`, SE-03) that were recorded in the window. */
  signups: number;
}

/** `GET /api/admin/seo/top-comuni?days=`: comuni by CTA clicks, with the window and how long events are kept. */
export interface SeoTopComuniResponse {
  days: number;
  from: string;
  to: string;
  /** Events older than this are deleted (`Seo:Events:RetentionDays`): a longer window shows less than asked. */
  retentionDays: number;
  items: SeoTopComune[];
}
