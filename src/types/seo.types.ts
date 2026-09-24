export type SeoPageType = 'ComplianceGuide' | 'TouristTaxCalc' | 'SupplierMicrosite';
export type LegalReviewStatus = 'Draft' | 'Reviewed';

export interface SeoDisclaimers {
  lastUpdated: string;
  notLegalAdvice: string;
  aiGenerated: string;
}

export interface SeoCta {
  complianceCheckerUrl: string;
  signupUrl: string;
}

export interface PublicTouristTaxRateSummary {
  ratePerPersonPerNight: number;
  maxNights: number | null;
  minimumAge: number;
  city: string;
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
  disclaimers: SeoDisclaimers;
  cta: SeoCta;
  touristTaxRate: PublicTouristTaxRateSummary | null;
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
}

export interface PublicTouristTaxCalculateResponse {
  comuneSlug: string;
  city: string;
  taxAmount: number;
  numberOfAdults: number;
  numberOfChildren: number;
  nights: number;
  ratePerPersonPerNight: number;
  maxNightsApplied: number;
  checkInDate: string;
  checkOutDate: string;
  disclaimer: string;
}

export interface SeoRevisionAdmin {
  generatedAt: string;
  aiModelTier: string;
  promptTokens: number;
  sourceDataVersion: string;
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
  legalReviewStatus: LegalReviewStatus;
  publishedAt: string | null;
  lastRefreshedAt: string | null;
  latestRevision: SeoRevisionAdmin | null;
}

export interface SeoPagesPagedResult {
  items: SeoPageAdmin[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export interface SeoGenerateRequest {
  comuneCodes: string[];
  pageTypes?: SeoPageType[];
  forceRegenerate?: boolean;
  autoApproveCounsel?: boolean;
}

export interface SeoComuneRegistryItem {
  code: string;
  name: string;
  regionSlug: string;
  comuneSlug: string;
}

export interface SeoBulkApproveResult {
  approvedCount: number;
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

export interface UpdateSeoReviewStatusRequest {
  legalReviewStatus: LegalReviewStatus;
  counselApproved?: boolean;
}

export interface SeoPagesQuery {
  legalReviewStatus?: LegalReviewStatus;
  pageType?: SeoPageType;
  comuneCode?: string;
  page?: number;
  pageSize?: number;
}
