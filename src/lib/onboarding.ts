import type { RentalType } from '@/types';
import { getUserRoles, isAdmin, ROLE_ADMIN, ROLE_LONG_TERM_LANDLORD, ROLE_PROPERTY_OWNER, ROLE_SUPPLIER } from '@/lib/auth-roles';
import type { UserWithRoles } from '@/lib/auth-roles';
import { getHttpStatus } from '@/lib/api-errors';

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

/** Where a supplier-only user lands: the activation wizard (an active supplier is sent on to the dashboard). */
export const SUPPLIER_HOME_ROUTE = '/app/supplier/activation';

type SupplierLinkProfile = { orgId?: string | null; supplierOrgId?: string | null } | null | undefined;

/**
 * True when `/users/me` says the account is linked to a supplier profile (invite, registration or claim, SU-02).
 * Unlike the Supplier role it does not wait for a fresh access token (`rolesSynced: false`).
 */
export function isLinkedSupplier(profile: SupplierLinkProfile): boolean {
  return !!profile?.supplierOrgId;
}

function hasHostRole(roles: string[]): boolean {
  return roles.includes(ROLE_PROPERTY_OWNER) || roles.includes(ROLE_LONG_TERM_LANDLORD);
}

export function getHomeRouteForUser(user: UserWithRoles, profile?: SupplierLinkProfile): string {
  if (isAdmin(user)) {
    return '/app/admin';
  }

  const roles = getUserRoles(user);
  const isHost = hasHostRole(roles);

  if ((roles.includes(ROLE_SUPPLIER) || isLinkedSupplier(profile)) && !isHost) {
    return SUPPLIER_HOME_ROUTE;
  }

  if (roles.includes(ROLE_LONG_TERM_LANDLORD) && !roles.includes(ROLE_PROPERTY_OWNER)) {
    return '/app/long-rent/leases';
  }

  return '/app/short-rent';
}

/**
 * True when `GET /users/me` failed for a reason that says nothing about the onboarding (5xx, network, session):
 * the UI offers a retry instead of the wizard (A1-19). Only a 404 (no profile at all) counts as "not onboarded".
 */
export function isProfileLoadFailure(error: unknown): boolean {
  return error != null && getHttpStatus(error) !== 404;
}

/** True when the caller has no tenant org yet (blocks property create, plan, entitlement). */
export function needsOrgSetup(profile?: { orgId?: string | null } | null): boolean {
  return !profile?.orgId;
}

/**
 * Platform admins and supplier-only users do not need a host org, so they are never sent through the host
 * onboarding (A1-01): the admin reaches the admin routes, the supplier its console. Both can still open
 * `/onboarding` themselves to set up a host org.
 */
export function isExemptFromHostOnboarding(roles: string[]): boolean {
  if (roles.includes(ROLE_ADMIN)) return true;
  return roles.includes(ROLE_SUPPLIER) && !hasHostRole(roles);
}

export function needsOnboarding(
  user: UserWithRoles,
  profile?: { orgId?: string | null; supplierOrgId?: string | null; onboardingCompletedAt?: string | null } | null,
  roles?: string[],
): boolean {
  const resolvedRoles = roles ?? getUserRoles(user);

  // Admins and supplier-only users skip it even without an org (#285 used to trap admins here).
  if (isExemptFromHostOnboarding(resolvedRoles)) {
    return false;
  }

  // A supplier linked in the database goes to its console, never to the host onboarding (A4-02), even while the
  // Supplier role is not in the access token yet. A host org can still be set up from `/onboarding`.
  if (isLinkedSupplier(profile)) {
    return false;
  }

  // Hosts without an org (roles assigned by hand in Auth0, org never provisioned) complete it to get one.
  if (needsOrgSetup(profile)) {
    return true;
  }

  // Timestamp is the single source of truth (#277)
  if (profile?.onboardingCompletedAt) {
    return false;
  }

  return resolvedRoles.length === 0;
}

const RENTAL_TYPE_CONTEXT_PREFIXES: Record<RentalType, string[]> = {
  ShortTerm: ['/app/short-rent'],
  LongTerm: ['/app/long-rent'],
  Both: ['/app/short-rent', '/app/long-rent'],
};

/**
 * Where to go once the onboarding is done: back to the page the guard redirected from when it belongs to a
 * context the chosen rental type opens, otherwise the home of that rental type.
 */
export function getPostOnboardingRoute(rentalType: RentalType, from?: string | null): string {
  if (from) {
    const prefixes = RENTAL_TYPE_CONTEXT_PREFIXES[rentalType] ?? [];
    if (prefixes.some((prefix) => from === prefix || from.startsWith(`${prefix}/`))) {
      return from;
    }
  }
  return getHomeRouteForRentalType(rentalType);
}

/**
 * Check if user can enter edit mode.
 * Requires both: onboardingCompletedAt (proof of completion) AND orgId (org exists).
 */
export function canEditOnboarding(
  profile?: { orgId?: string | null; onboardingCompletedAt?: string | null } | null,
): boolean {
  if (!profile) return false;
  return !!profile.onboardingCompletedAt && !!profile.orgId;
}
