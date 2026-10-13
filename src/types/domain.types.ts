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
}

export interface SetOrgDomainRequest {
  hostMode: PublicHostMode;
  customDomain?: string;
  subdomain?: string;
}

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
  branding: {
    logoUrl?: string | null;
    primaryColor?: string | null;
    publicThemeId?: string | null;
    heroImageUrl?: string | null;
    tagline?: string | null;
    displayName: string;
    slug: string;
    showPoweredBy: boolean;
  };
}
