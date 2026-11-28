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

  setSurfaces: (orgId: string, payload: SetDomainSurfacesRequest): Promise<OrgDomainConfig> =>
    ApiClient.put<OrgDomainConfig>(`/orgs/${orgId}/domain/surfaces`, payload),

  requestOwnerLogin: (orgId: string): Promise<OrgDomainConfig> =>
    ApiClient.post<OrgDomainConfig>(`/orgs/${orgId}/domain/owner-login`, {}),

  resolveHost: (host: string): Promise<ResolveHostResponse> =>
    ApiClient.get<ResolveHostResponse>('/public/resolve-host', { host }, { public: true }),
};
