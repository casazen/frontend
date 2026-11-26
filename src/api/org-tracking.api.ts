import { ApiClient } from '@/api/client';
import type { OrgDomainTracking, SetOrgTrackingRequest } from '@/types/domain.types';

/**
 * The tracking of the agency's pages (E41/F03/US01, NF-149). There is no read of its own: the container is the `tracking` member of the domain settings (`GET /orgs/{id}/domain`), which
 * the page already reads; this is the write, for the account administrator alone. The server checks the format (`GTM-` and 4 to 12 letters or digits, after trimming and upper-casing) and
 * answers 400 `gtm_container_id_invalid` with a message in the language of the request for anything else, and 404 while the embeddable pages are off.
 */
export const OrgTrackingApi = {
  /** Saves the container, or clears it with `null`. The answer is what the server now holds: the id as it stores it (upper case), `null` when it is cleared. */
  setTracking: (orgId: string, payload: SetOrgTrackingRequest): Promise<OrgDomainTracking> =>
    ApiClient.put<OrgDomainTracking>(`/orgs/${orgId}/domain/tracking`, payload),
};
