import { useEntitlement } from '@/queries/use-users';

/**
 * Hook to access organization-level flags and tier information.
 * Exposes isAgency from the entitlement response (ADR-010).
 */
export function useOrg() {
  const entitlementQuery = useEntitlement();

  return {
    ...entitlementQuery,
    isAgency: entitlementQuery.data?.isAgency ?? false,
  };
}
