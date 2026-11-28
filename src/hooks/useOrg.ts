import { useEntitlement } from '@/queries/use-users';

export function useOrg() {
  const entitlementQuery = useEntitlement();

  return {
    ...entitlementQuery,
    isAgency: entitlementQuery.data?.isAgency ?? false,
  };
}
