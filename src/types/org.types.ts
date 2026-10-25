// US-004 (#202) tenant boundary — org + plan entitlement surfaced read-only on the frontend.

export type PlanTier = 'Starter' | 'Pro' | 'Scale' | 'Agency';

/** Public projection of the caller's organization (AC9/AC11). Never carries Stripe/billing ids. */
export interface Org {
  id: string;
  name: string;
  slug: string;
  planTier: PlanTier;
}

export interface EntitlementLimits {
  maxProperties: number;
  /** People the plan allows (AM-02): int max (2147483647) or -1 is "no limit". Missing from a backend that has no seats yet. */
  maxSeats?: number;
}

export interface EntitlementUsage {
  properties: number;
  /** People in use: active members plus pending invitations (AM-02). */
  seats?: number;
}

/** Resolved plan entitlement for the caller's org (AC8). Backs the plan badge + create gating. */
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
  /** The plan has a free seat for one more person (AM-02). */
  canInviteMember?: boolean;
  /** Whether the org has the Agency tier (ADR-010). */
  isAgency?: boolean;
}

/** Catalogue entry from GET /api/orgs/plans. maxProperties = -1 means unlimited. */
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
  /** The registered office ("sede legale") in one line. */
  registeredOffice: string | null;
}

/** Anonymous branding read-model for /book/:orgSlug (US-003 #215, US-023 #297). */
export interface PublicOrgDto {
  slug: string;
  displayName: string;
  logoUrl: string | null;
  /** Primary color of the site (`#rrggbb`), null for the theme's own color (BK-12). */
  primaryColor?: string | null;
  /** Same value as primaryColor, kept by the backend for older clients. */
  themeColor: string | null;
  /** Only present when the org opted in to publish it (A1-22, A1-23) — off by default (GDPR). */
  contactEmail: string | null;
  heroImageUrl?: string | null;
  tagline?: string | null;
  /** Always a supported theme id (see `src/lib/public-site-themes.ts`); older backends may send null. */
  publicThemeId?: string | null;
  showPoweredBy?: boolean;
  /** Absolute URL of the landing page on the public domain, from the backend (BK-15); null when it is not configured. */
  canonicalUrl?: string | null;
  /** Legal name, registered office and VAT number for the footer (DB-03b-a); null while the host entered none; absent on an older backend. */
  operator?: PublicOperator | null;
}

/** Image of the public-site branding with its own upload/remove endpoints (BK-12). */
export type BrandingImageKind = 'logo' | 'hero';

/** The caller org's public-site branding (BK-12, A3-17): GET/PUT /api/orgs/me/branding, org billing admin only. */
export interface OrgBranding {
  /** Absolute public URL, or null (the site shows the display name). */
  logoUrl: string | null;
  /** Absolute public URL, or null (the landing uses the first property photo). */
  heroImageUrl: string | null;
  /** `#rrggbb`, or null for the theme's own color. */
  primaryColor: string | null;
  /** Always one of the supported theme ids. */
  publicThemeId: string;
  tagline: string | null;
  /** Public slug (preview link /book/{slug}), edited in the org settings. */
  slug: string;
  displayName: string;
  showPoweredBy: boolean;
}

/** Body of PUT /api/orgs/me/branding: text branding, replaced as a whole (null = theme color / default theme / none). */
export interface UpdateOrgBrandingRequest {
  primaryColor: string | null;
  publicThemeId: string;
  tagline: string | null;
}

/** The caller org's editable identity (A1-22, A1-23): GET/PUT /api/orgs/me/settings, org billing admin only. */
export interface OrgSettings {
  id: string;
  name: string;
  slug: string;
  contactEmail: string;
  /** Whether contactEmail is shown on the public booking site (PublicOrgDto). Off by default. */
  contactEmailPublic: boolean;
  /** Legal name ("ragione sociale") of the operator, shown in the footer of the booking site (DB-03b-a); null while not entered, absent on an older backend. */
  legalName?: string | null;
  /** Registered office ("sede legale") of the operator, one line, shown in the same footer (DB-03b-a). */
  registeredOffice?: string | null;
}

export interface UpdateOrgSettingsRequest {
  name: string;
  slug: string;
  contactEmail: string;
  contactEmailPublic: boolean;
  /** Operator data (DB-03b-a): left out = unchanged on the server, an empty string clears it. */
  legalName?: string;
  registeredOffice?: string;
}

/** GET /api/orgs/me/settings/slug-availability (A1-23). */
export interface OrgSlugAvailability {
  /** The slug as it would be saved (sanitized). */
  slug: string;
  available: boolean;
  /** Why it is not available: org_slug_invalid, org_slug_reserved or org_slug_taken; null when available. */
  code: string | null;
}

/** The operator documents of the public booking site (BK-14, A3-21): the host's own privacy notice and booking terms. */
export type OrgSiteDocumentKind = 'privacy' | 'terms';

/** How the host provides a document: text written in CasaZen, or the https address of a document hosted elsewhere. */
export type OrgSiteDocumentSource = 'Text' | 'ExternalUrl';

/** One version of an operator document (GET /api/orgs/me/site-documents), org billing admin only. */
export interface OrgSiteDocumentVersion {
  version: number;
  source: OrgSiteDocumentSource;
  /** The text as written; null in the history list and for an address. */
  content: string | null;
  externalUrl: string | null;
  publishedAt: string;
  /** When the host withdrew it; null while the public site shows it. */
  withdrawnAt: string | null;
}

export interface OrgSiteDocumentState {
  kind: OrgSiteDocumentKind;
  /** True when the public site shows the document (there is a current version and it was not withdrawn). */
  published: boolean;
  /** The current (highest) version with its text; null when never published. */
  current: OrgSiteDocumentVersion | null;
  /** Recent versions, newest first, without text. */
  history: OrgSiteDocumentVersion[];
}

/** Body of PUT /api/orgs/me/site-documents/{kind}: a new version; only the field of `source` is used. */
export interface PublishOrgSiteDocumentRequest {
  source: OrgSiteDocumentSource;
  content?: string;
  externalUrl?: string;
}

/**
 * An operator document as the guest sees it (GET /api/public/orgs/{slug}/documents/{kind}, anonymous). Not published
 * (never, or withdrawn): `published` false and nothing else set.
 */
export interface PublicOrgDocument {
  kind: OrgSiteDocumentKind;
  published: boolean;
  version: number | null;
  source: OrgSiteDocumentSource | null;
  /** Sanitized HTML of the text (`source` Text); the page sanitizes it again before rendering. */
  contentHtml: string | null;
  /** Absolute https address of the document (`source` ExternalUrl). */
  externalUrl: string | null;
  publishedAt: string | null;
}
