import { ApiClient } from '@/api/client';
import type {
  OrgDomainConfig,
  OrgDomainVerifyResult,
  ResolveHostResponse,
  SetDomainSurfacesRequest,
  SetOrgDomainRequest,
} from '@/types/domain.types';

export const DomainApi = {
  getDomain: (orgId: string): Promise<OrgDomainConfig> =>
    ApiClient.get<OrgDomainConfig>(`/orgs/${orgId}/domain`),

  setDomain: (orgId: string, payload: SetOrgDomainRequest): Promise<OrgDomainConfig> =>
    ApiClient.post<OrgDomainConfig>(`/orgs/${orgId}/domain`, payload),

  verifyDomain: (orgId: string): Promise<OrgDomainVerifyResult> =>
    ApiClient.post<OrgDomainVerifyResult>(`/orgs/${orgId}/domain/verify`, {}),

  /** What runs on the agency's own domain (E40/F02/US02): the three choices, all three every time. The answer is the whole configuration. */
  setSurfaces: (orgId: string, payload: SetDomainSurfacesRequest): Promise<OrgDomainConfig> =>
    ApiClient.put<OrgDomainConfig>(`/orgs/${orgId}/domain/surfaces`, payload),

  /** Asks again for the sign-in of the owners on the agency's own domain, after it failed. The answer is the whole configuration. */
  requestOwnerLogin: (orgId: string): Promise<OrgDomainConfig> =>
    ApiClient.post<OrgDomainConfig>(`/orgs/${orgId}/domain/owner-login`, {}),

  resolveHost: (host: string): Promise<ResolveHostResponse> =>
    ApiClient.get<ResolveHostResponse>('/public/resolve-host', { host }, { public: true }),
};
