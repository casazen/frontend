export type PublicHostMode = 'CasazenPath' | 'CasazenSubdomain' | 'CustomDomain';

export type DomainVerificationStatus = 'Pending' | 'Verified' | 'Failed';

/**
 * Stable codes of why a custom domain is not (or no longer) verified (backend `DomainIssues`, BK-17). The page explains
 * each one in the user's language (`domain.issues.<code>`); an unknown code falls back to the server message.
 */
export type DomainIssueCode =
  | 'ownership_txt_missing'
  | 'dns_not_pointing'
  | 'vercel_verification_pending'
  | 'vercel_not_configured'
  | 'vercel_unauthorized'
  | 'vercel_unavailable'
  | 'domain_taken'
  | 'vercel_domain_in_use'
  | 'vercel_rejected';

export interface DnsInstructions {
  cnameHost: string;
  cnameTarget: string;
  txtHost: string;
  txtValue: string;
  /** Server text in Italian: the page uses its own translated note. */
  sslNote: string;
  /** IPv4 addresses of the A record, the alternative to the CNAME for the root of a domain (no `www`). */
  aRecordValues?: string[];
  /** The service provider's own TXT record, only when it asks for one before confirming the domain. */
  vercelTxtHost?: string | null;
  vercelTxtValue?: string | null;
}

/** Honest state of the custom domain: why it waits, when it was last checked, whether the platform can activate it. */
export interface DomainStatusInfo {
  detail?: string | null;
  message?: string | null;
  checkedAt?: string | null;
  verifiedAt?: string | null;
  /** False while the platform has no token/project to activate domains: nothing the host does can activate one. */
  activationAvailable: boolean;
  /** The periodic check still runs for this domain. */
  autoCheckActive: boolean;
}

export interface PublicUrls {
  pathUrl: string;
  subdomainUrl?: string | null;
  customDomainUrl?: string | null;
}

/** Where the sign-in of the owners on the agency's own domain stands (backend `OwnerLoginHostState`, E40/F01/US02). */
export type OwnerLoginHostState = 'NotRequested' | 'Pending' | 'Ready' | 'Failed';

/** What is really on the agency's own domain now: the choice of the agency together with what the platform, the plan, the domain and the owner sign-in allow. */
export interface DomainSurfacesEffective {
  guestArea: boolean;
  ownerPortal: boolean;
  ownerLoginReady: boolean;
  linksOnOwnDomain: boolean;
}

/**
 * The surfaces of the agency's own domain (E40/F01/US01, NF-140..NF-142): what the agency chose to serve on it, how the owner sign-in stands and what is really on.
 * The backend sends it only while `WhiteLabelHost` is on.
 */
export interface DomainSurfaces {
  guestAreaOnOwnDomain: boolean;
  ownerPortalOnOwnDomain: boolean;
  useOwnDomainForLinks: boolean;
  ownerLoginHostState: OwnerLoginHostState;
  /** With `Pending`: true while the platform registers the domain by itself, false while CasaZen enables it by hand. */
  ownerLoginAutomatic: boolean;
  effective: DomainSurfacesEffective;
}

export interface OrgDomainConfig {
  orgId: string;
  publicHostMode: PublicHostMode;
  subdomain?: string | null;
  customDomain?: string | null;
  domainVerificationStatus: DomainVerificationStatus;
  canUseCustomDomain: boolean;
  dnsInstructions?: DnsInstructions | null;
  publicUrls: PublicUrls;
  status?: DomainStatusInfo;
  /** `null` while the platform has the surfaces of the agency domain off, absent on an older backend: either way there is nothing to show (E40/F02/US02). */
  surfaces?: DomainSurfaces | null;
}

export interface SetOrgDomainRequest {
  hostMode: PublicHostMode;
  customDomain?: string;
  subdomain?: string;
}

/** `PUT /orgs/{id}/domain/surfaces`: the three choices of the agency, always all three. */
export type SetDomainSurfacesRequest = Pick<DomainSurfaces, 'guestAreaOnOwnDomain' | 'ownerPortalOnOwnDomain' | 'useOwnDomainForLinks'>;

export interface OrgDomainVerifyResult {
  domainVerificationStatus: DomainVerificationStatus;
  customDomain: string;
  checkedAt: string;
  detail?: string | null;
  message?: string | null;
  vercelTxtHost?: string | null;
  vercelTxtValue?: string | null;
}

export interface ResolveHostResponse {
  orgId: string;
  slug: string;
  publicHostMode: PublicHostMode;
  planTier: string;
  /** The embeddable pages (`/embed/*`) are on for this host: the flag `SiteEmbed` and the plan allow them (E40, NF-144). Absent on an older backend: off. */
  embedEnabled?: boolean;
  /** What the agency set for tracking: its Google Tag Manager container, or null when it set none (E40, NF-149). Absent on an older backend. */
  tracking?: { gtmContainerId: string | null } | null;
  /**
   * What the domain serves besides the booking site (E40, NF-140): the guest check-in page and the owner portal. True only with the flag `WhiteLabelHost`, an allowed plan, a verified domain and the setting of the
   * agency. Absent on an older backend, and a missing member of it: off, the host then serves exactly what it served before.
   */
  surfaces?: { guestArea?: boolean; ownerPortal?: boolean } | null;
  /** The domain is registered with the sign-in service, so the owners can sign in on it (E40, NF-141); only meaningful with `surfaces.ownerPortal`. Absent on an older backend: false. */
  ownerLoginReady?: boolean;
  branding: {
    logoUrl?: string | null;
    primaryColor?: string | null;
    publicThemeId?: string | null;
    publicFontId?: string | null;
    heroImageUrl?: string | null;
    tagline?: string | null;
    displayName: string;
    slug: string;
    showPoweredBy: boolean;
  };
}
