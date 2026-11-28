import { ApiClient } from '@/api/client';
import type { OrgDomainTracking, SetOrgTrackingRequest } from '@/types/domain.types';

export const OrgTrackingApi = {
  setTracking: (orgId: string, payload: SetOrgTrackingRequest): Promise<OrgDomainTracking> =>
    ApiClient.put<OrgDomainTracking>(`/orgs/${orgId}/domain/tracking`, payload),
};
