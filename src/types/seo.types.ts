import type { TouristTaxQuoteStatus, TouristTaxRateRule } from './tourist-tax.types';

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
  canonicalUrl: string;
  lastRefreshedAt: string | null;
  disclaimers: SeoDisclaimers;
  cta: SeoCta;
  /** Rates in force today; empty when CasaZen has no rate for the comune (A8-12). */
  touristTaxRates: PublicTouristTaxRateSummary[];
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
