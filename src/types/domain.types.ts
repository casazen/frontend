export type PublicHostMode = 'CasazenPath' | 'CasazenSubdomain' | 'CustomDomain';

export type DomainVerificationStatus = 'Pending' | 'Verified' | 'Failed';

export interface DnsInstructions {
  cnameHost: string;
  cnameTarget: string;
  txtHost: string;
  txtValue: string;
  sslNote: string;
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
  message?: string | null;
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
