import type { RentalType } from '@/types';
import { getUserRoles, isAdmin, ROLE_LONG_TERM_LANDLORD, ROLE_PROPERTY_OWNER } from '@/lib/auth-roles';
import type { UserWithRoles } from '@/lib/auth-roles';

export const RENTAL_TYPE_LABELS: Record<RentalType, string> = {
  ShortTerm: 'Affitti brevi',
  LongTerm: 'Locazioni di lungo periodo',
  Both: 'Entrambi',
};

export function getHomeRouteForRentalType(rentalType: RentalType): string {
  switch (rentalType) {
    case 'LongTerm':
      return '/app/long-rent/leases';
    case 'Both':
    case 'ShortTerm':
    default:
      return '/app/short-rent';
  }
}

export function getHomeRouteForUser(user: UserWithRoles): string {
  if (isAdmin(user)) {
    return '/app/admin';
  }

  const roles = getUserRoles(user);
  if (roles.includes(ROLE_LONG_TERM_LANDLORD) && !roles.includes(ROLE_PROPERTY_OWNER)) {
    return '/app/long-rent/leases';
  }

  return '/app/short-rent';
}

/** True when the caller has no tenant org yet (blocks property create, plan, entitlement). */
export function needsOrgSetup(profile?: { orgId?: string | null } | null): boolean {
  return !profile?.orgId;
}

export function needsOnboarding(
  user: UserWithRoles,
  profile?: { orgId?: string | null } | null,
): boolean {
  if (needsOrgSetup(profile)) {
    return true;
  }
  if (isAdmin(user)) {
    return false;
  }
  return getUserRoles(user).length === 0;
}
