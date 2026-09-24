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

export function getHomeRouteForUser(user: UserWithRoles): string {
  if (isAdmin(user)) {
    return '/app/admin';
  }

  const roles = getUserRoles(user);
  const isHost =
    roles.includes(ROLE_PROPERTY_OWNER) || roles.includes(ROLE_LONG_TERM_LANDLORD);

  if (roles.includes(ROLE_SUPPLIER) && !isHost) {
    return '/supplier/inbox';
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
  const isHost = roles.includes(ROLE_PROPERTY_OWNER) || roles.includes(ROLE_LONG_TERM_LANDLORD);
  return roles.includes(ROLE_SUPPLIER) && !isHost;
}

/** Profile fields that decide the onboarding (`GET /users/me`). */
export interface OnboardingProfile {
  orgId?: string | null;
  onboardingCompletedAt?: string | null;
  rentalType?: RentalType | null;
  /** Backend gate (PL-02): host features withheld until the onboarding and the current consents. */
  onboardingRequired?: boolean | null;
  consentsAccepted?: boolean | null;
}

export function needsOnboarding(user: UserWithRoles, profile?: OnboardingProfile | null, roles?: string[]): boolean {
  const resolvedRoles = roles ?? getUserRoles(user);

  // Admins and supplier-only users skip it even without an org (#285 used to trap admins here).
  if (isExemptFromHostOnboarding(resolvedRoles)) {
    return false;
  }

  // Hosts without an org (roles assigned by hand in Auth0, org never provisioned) complete it to get one.
  if (needsOrgSetup(profile)) {
    return true;
  }

  // PL-02: the backend withholds the host features (onboarding never completed, or legal documents changed).
  if (profile?.onboardingRequired === true) {
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
 * The onboarding was completed but a legal document changed since (backend `consentsAccepted: false`, PL-02): only
 * the consents step is needed, submitted with the rental type already chosen.
 */
export function needsConsentRenewal(profile?: OnboardingProfile | null): boolean {
  return (
    !!profile?.orgId &&
    !!profile.onboardingCompletedAt &&
    !!profile.rentalType &&
    profile.consentsAccepted === false
  );
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
