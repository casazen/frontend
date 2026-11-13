import { useOrg } from '@/hooks/useOrg';
import { useCurrentUser } from '@/queries/use-users';

/**
 * Whether the organization is on the agency plan, as the pages of the agency's money need to know it before they read anything: the backend answers every
 * `agency.*` endpoint with a bare 403 to an organization on another plan, and a refused read sends the whole app to the page of no access. The plan is read
 * from the entitlement of the organization (an endpoint of the billing administrator: call this only after the role was checked). While the person or the
 * entitlement is still on its way the answer is «loading», never «not on the plan»; a failed read of the entitlement is `failed`, not «not on the plan» either.
 */
export function useAgencyPlan() {
  const me = useCurrentUser();
  const org = useOrg();
  return {
    isAgency: org.isAgency,
    isLoading: me.isLoading || org.isLoading,
    failed: org.isError && org.data === undefined,
    retry: () => void org.refetch(),
  };
}
