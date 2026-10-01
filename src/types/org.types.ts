// US-004 (#202) tenant boundary — org + plan entitlement surfaced read-only on the frontend.

export type PlanTier = 'Starter' | 'Pro' | 'Scale';

/** Public projection of the caller's organization (AC9/AC11). Never carries Stripe/billing ids. */
export interface Org {
  id: string;
  name: string;
  slug: string;
  planTier: PlanTier;
}

export interface EntitlementLimits {
  maxProperties: number;
}

export interface EntitlementUsage {
  properties: number;
}

/** Resolved plan entitlement for the caller's org (AC8). Backs the plan badge + create gating. */
export interface Entitlement {
  orgId: string;
  planTier: PlanTier;
  limits: EntitlementLimits;
  usage: EntitlementUsage;
  canAddProperty: boolean;
  canUseCustomDomain?: boolean;
}

/** Catalogue entry from GET /api/orgs/plans. maxProperties = -1 means unlimited. */
export interface PlanCatalogEntry {
  tier: PlanTier;
  displayName: string;
  maxProperties: number;
  description: string;
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
}

export interface UpdateOrgSettingsRequest {
  name: string;
  slug: string;
  contactEmail: string;
  contactEmailPublic: boolean;
}

/** GET /api/orgs/me/settings/slug-availability (A1-23). */
export interface OrgSlugAvailability {
  /** The slug as it would be saved (sanitized). */
  slug: string;
  available: boolean;
  /** Why it is not available: org_slug_invalid, org_slug_reserved or org_slug_taken; null when available. */
  code: string | null;
}
