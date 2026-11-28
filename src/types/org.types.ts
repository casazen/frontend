export type PlanTier = 'Starter' | 'Pro' | 'Scale' | 'Agency';

/** Public projection of the caller's organization (AC9/AC11). Never carries Stripe/billing ids. */
export interface Org {
  isAgency?: boolean;
  id: string;
  name: string;
  slug: string;
  planTier: PlanTier;
}

interface EntitlementLimits {
  maxProperties: number;
  maxSeats?: number;
}

interface EntitlementUsage {
  properties: number;
  seats?: number;
}

export interface Entitlement {
  orgId: string;
  planTier: PlanTier;
  limits: EntitlementLimits;
  usage: EntitlementUsage;
  canAddProperty: boolean;
  canUseCustomDomain?: boolean;
  /**
   * "Accesso aperto" (BL-01): `planTier` is higher than the plan the org pays for, because the open access is on. Only in
   * `GET /api/orgs/me/entitlement` (billing administrator).
   */
  openAccess?: boolean;
  canInviteMember?: boolean;
  isAgency?: boolean;
}

export interface PlanCatalogEntry {
  tier: PlanTier;
  displayName: string;
  maxProperties: number;
  description: string;
}

/**
 * Who runs a booking site, as its footer shows it (DB-03b-a): only what the host entered, a member is null when empty, never an
 * empty string. The VAT number is the one of the fiscal profile, present only while the host declares it has one.
 */
export interface PublicOperator {
  legalName: string | null;
  vatNumber: string | null;
  registeredOffice: string | null;
}

export interface PublicOrgDto {
  slug: string;
  displayName: string;
  logoUrl: string | null;
  primaryColor?: string | null;
  themeColor: string | null;
  /** Only present when the org opted in to publish it (A1-22, A1-23) — off by default (GDPR). */
  contactEmail: string | null;
  canContactHost?: boolean;
  storefrontChatEnabled?: boolean;
  heroImageUrl?: string | null;
  tagline?: string | null;
  publicThemeId?: string | null;
  publicFontId?: string | null;
  showPoweredBy?: boolean;
  /**
   * Version of the text of the optional «send me offers» consent (DB-03, `Gdpr:MarketingConsentVersion`), or null while the text has no
   * version: the checkout then shows no box and the API refuses a `marketingConsent: true`. Absent on an older backend.
   */
  marketingConsentVersion?: string | null;
  /**
   * Version of the soft opt-in notice the checkout shows to the customer (`Gdpr:SoftOptInNoticeVersion`, art. 130 c. 4 Codice privacy, PO-07),
   * or null while the product owner has not set one: the checkout then shows no notice and the booking does not send a version back.
   * Absent on an older backend.
   */
  softOptInNoticeVersion?: string | null;
  canonicalUrl?: string | null;
  /** Legal name, registered office and VAT number for the footer (DB-03b-a); null while the host entered none; absent on an older backend. */
  operator?: PublicOperator | null;
  hostName?: string | null;
  publicPhone?: string | null;
  acceptsBookings?: boolean;
}

export interface HostContactPayload {
  email: string;
  message: string;
  name: string;
  propertyId?: string;
  /** The language of the site the visitor was reading, so that the host answers in it. */
  lang?: 'it' | 'en';
  consent: true;
  website?: string;
}

export type BrandingImageKind = 'logo' | 'hero';

export interface OrgBranding {
  logoUrl: string | null;
  heroImageUrl: string | null;
  primaryColor: string | null;
  publicThemeId: string;
  publicFontId?: string | null;
  tagline: string | null;
  slug: string;
  displayName: string;
  showPoweredBy: boolean;
}

export interface UpdateOrgBrandingRequest {
  primaryColor: string | null;
  publicThemeId: string;
  publicFontId?: string | null;
  tagline: string | null;
}

export interface OrgSettings {
  id: string;
  name: string;
  slug: string;
  contactEmail: string;
  contactEmailPublic: boolean;
  legalName?: string | null;
  registeredOffice?: string | null;
  contactPhone?: string | null;
  defaultLanguage?: OrgLanguage;
}

export type OrgLanguage = 'it' | 'en';

export interface UpdateOrgSettingsRequest {
  name: string;
  slug: string;
  contactEmail: string;
  contactEmailPublic: boolean;
  legalName?: string;
  registeredOffice?: string;
  contactPhone?: string;
  defaultLanguage?: OrgLanguage;
}

export interface OrgSlugAvailability {
  slug: string;
  available: boolean;
  code: string | null;
}

export type OrgSiteDocumentKind = 'privacy' | 'terms';

export type OrgSiteDocumentSource = 'Text' | 'ExternalUrl';

export interface OrgSiteDocumentVersion {
  version: number;
  source: OrgSiteDocumentSource;
  content: string | null;
  externalUrl: string | null;
  publishedAt: string;
  withdrawnAt: string | null;
}

export interface OrgSiteDocumentState {
  kind: OrgSiteDocumentKind;
  published: boolean;
  current: OrgSiteDocumentVersion | null;
  history: OrgSiteDocumentVersion[];
}

export interface PublishOrgSiteDocumentRequest {
  source: OrgSiteDocumentSource;
  content?: string;
  externalUrl?: string;
}

export interface PublicOrgDocument {
  kind: OrgSiteDocumentKind;
  published: boolean;
  version: number | null;
  source: OrgSiteDocumentSource | null;
  contentHtml: string | null;
  externalUrl: string | null;
  publishedAt: string | null;
}
