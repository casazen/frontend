export type PublicHostMode = 'CasazenPath' | 'CasazenSubdomain' | 'CustomDomain';

export type DomainVerificationStatus = 'Pending' | 'Verified' | 'Failed';

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
  sslNote: string;
  aRecordValues?: string[];
  vercelTxtHost?: string | null;
  vercelTxtValue?: string | null;
}

interface DomainStatusInfo {
  detail?: string | null;
  message?: string | null;
  checkedAt?: string | null;
  verifiedAt?: string | null;
  activationAvailable: boolean;
  autoCheckActive: boolean;
}

export interface PublicUrls {
  pathUrl: string;
  subdomainUrl?: string | null;
  customDomainUrl?: string | null;
}

type OwnerLoginHostState = 'NotRequested' | 'Pending' | 'Ready' | 'Failed';

interface DomainSurfacesEffective {
  guestArea: boolean;
  ownerPortal: boolean;
  ownerLoginReady: boolean;
  linksOnOwnDomain: boolean;
}

export interface DomainSurfaces {
  guestAreaOnOwnDomain: boolean;
  ownerPortalOnOwnDomain: boolean;
  useOwnDomainForLinks: boolean;
  ownerLoginHostState: OwnerLoginHostState;
  ownerLoginAutomatic: boolean;
  effective: DomainSurfacesEffective;
}

export interface OrgDomainTracking {
  gtmContainerId: string | null;
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
  surfaces?: DomainSurfaces | null;
  tracking?: OrgDomainTracking | null;
}

export interface SetOrgDomainRequest {
  hostMode: PublicHostMode;
  customDomain?: string;
  subdomain?: string;
}

export type SetDomainSurfacesRequest = Pick<DomainSurfaces, 'guestAreaOnOwnDomain' | 'ownerPortalOnOwnDomain' | 'useOwnDomainForLinks'>;

export type SetOrgTrackingRequest = OrgDomainTracking;

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
  embedEnabled?: boolean;
  tracking?: OrgDomainTracking | null;
  surfaces?: { guestArea?: boolean; ownerPortal?: boolean } | null;
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
