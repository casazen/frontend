import type { TouristTaxQuoteStatus, TouristTaxRateRule } from './tourist-tax.types';

export type SeoPageType = 'ComplianceGuide' | 'TouristTaxCalc' | 'SupplierMicrosite';
export type LegalReviewStatus = 'Draft' | 'Reviewed';

export interface SeoCta {
  signupUrl: string;
}

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
  canonicalUrl: string | null;
  lastRefreshedAt: string | null;
  aiGenerated: boolean;
  contentLanguage: string;
  cta: SeoCta | null;
  touristTaxRates: PublicTouristTaxRateSummary[];
}

export interface SeoPublishedPage {
  pageType: SeoPageType;
  title: string;
  comuneName: string;
  regionSlug: string;
  comuneSlug: string;
  path: string;
}

export interface SeoPublishedPages {
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

export type SeoContentStatus =
  | 'Generated'
  | 'Manual'
  | 'AiProviderNotConfigured'
  | 'EmptyOutput'
  | 'InvalidOutput'
  | 'Placeholder';

type SeoReviewAction = 'Approved' | 'Withdrawn';

interface SeoRevisionAdmin {
  id: string;
  generatedAt: string;
  aiModelTier: string;
  promptTokens: number;
  sourceDataVersion: string;
  contentStatus: SeoContentStatus;
  promptVersion: string | null;
}

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
  legalReviewStatus: LegalReviewStatus;
  publishedAt: string | null;
  lastRefreshedAt: string | null;
  latestRevision: SeoRevisionAdmin | null;
  publishedRevisionId: string | null;
  isPublished: boolean;
  hasPendingRevision: boolean;
  counselRequired: boolean;
  publicPath: string | null;
  publicUrl: string | null;
  lastReviewEvent: SeoReviewEvent | null;
}

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
  pendingRevision: SeoRevisionPreview | null;
  reviewHistory: SeoReviewEvent[];
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

export interface ApproveSeoRevisionRequest {
  revisionId: string;
  counselApproved: boolean;
  note?: string;
}

export interface WithdrawSeoPageRequest {
  note?: string;
}

export type AiProviderName = 'Stub' | 'DeepSeek' | 'OpenAI' | 'Anthropic' | 'OpenAiCompatible';

export interface AiAdminSettings {
  provider: AiProviderName;
  externalActive: boolean;
  apiKeyConfigured: boolean;
  apiKeyHint: string | null;
  model: string;
  baseUrl: string;
  source: 'environment' | 'admin';
  hasStoredKey: boolean;
}

export interface UpdateAiSettingsRequest {
  provider: AiProviderName;
  apiKey?: string;
  clearApiKey?: boolean;
  model?: string;
  baseUrl?: string;
}

export interface SaveSeoDraftRequest {
  bodyHtml: string;
  title?: string;
  metaDescription?: string;
}

export interface SeoPagesQuery {
  legalReviewStatus?: LegalReviewStatus;
  pageType?: SeoPageType;
  comuneCode?: string;
  page?: number;
  pageSize?: number;
}

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
  referrerHost?: string;
}

export interface FeaturedProperty {
  id: string;
  slug: string | null;
  orgSlug: string;
  name: string;
  city: string;
  bedrooms: number;
  bathrooms: number;
  maxGuests: number;
  nightlyRate: number;
  photoUrl: string | null;
}

export interface FeaturedPropertiesResponse {
  comuneSlug: string;
  comuneName: string;
  properties: FeaturedProperty[];
}

interface SeoTopComune {
  comuneCode: string;
  comuneName: string;
  ctaClicks: number;
  signupStarts: number;
  signups: number;
}

export interface SeoTopComuniResponse {
  days: number;
  from: string;
  to: string;
  retentionDays: number;
  items: SeoTopComune[];
}
