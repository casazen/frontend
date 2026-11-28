import type { RentalType } from '@/types';
import { getUserRoles, isAdmin, ROLE_ADMIN, ROLE_LONG_TERM_LANDLORD, ROLE_PROPERTY_OWNER, ROLE_SUPPLIER } from '@/lib/auth-roles';
import type { UserWithRoles } from '@/lib/auth-roles';
import { isAxiosError } from 'axios';
import { getHttpStatus } from '@/lib/api-errors';
import { planPagePath } from '@/lib/billing-routes';

export function getHomeRouteForRentalType(rentalType: RentalType): string {
  switch (rentalType) {
    case 'LongTerm':
      return '/app/long-rent';
    case 'Both':
    case 'ShortTerm':
    default:
      return '/app/short-rent';
  }
}

export const SUPPLIER_HOME_ROUTE = '/app/supplier/activation';

type SupplierLinkProfile = { orgId?: string | null; supplierOrgId?: string | null } | null | undefined;

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
    return '/app/long-rent';
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

export interface OnboardingProfile {
  orgId?: string | null;
  supplierOrgId?: string | null;
  onboardingCompletedAt?: string | null;
  rentalType?: RentalType | null;
  onboardingRequired?: boolean | null;
  consentsAccepted?: boolean | null;
  hasProperties?: boolean | null;
}

export function needsOnboarding(user: UserWithRoles, profile?: OnboardingProfile | null, roles?: string[]): boolean {
  const resolvedRoles = roles ?? getUserRoles(user);

  if (isExemptFromHostOnboarding(resolvedRoles)) {
    return false;
  }

  if (isLinkedSupplier(profile)) {
    return false;
  }

  // Hosts without an org (roles assigned by hand in Auth0, org never provisioned) complete it to get one.
  if (needsOrgSetup(profile)) {
    return true;
  }

  if (profile?.onboardingRequired === true) {
    return true;
  }

  if (profile?.onboardingCompletedAt) {
    return false;
  }

  return resolvedRoles.length === 0;
}

/**
 * Pages a host without properties must still reach: the creation of the property itself (the destination, so no loop),
 * and the pages that are not about the property (account settings and plan, profile, legal documents). The plan and billing page of
 * the account area (AM-08a) is one of them: the plan pages of the rental areas hand a billing administrator over to it. So is the
 * connection of the channel manager (E02/F01/US01/T04): whoever has the listings there and none in CasaZen yet starts from it, and the
 * page of the consent is also the one the channel manager sends the host back to (the callback), which must open as it is. And so is the
 * page where the administrator confirms that the plugin for WordPress connects a site (`/app/connect/wordpress`, PLG-FE-CONSOLE): the plugin
 * sends the person there with its whole request in the query, which a redirect to the first property would lose.
 */
const FIRST_PROPERTY_EXEMPT_PATTERNS = [
  /^\/(?:app\/(?:short|long)-rent\/)?properties\/(?:create|new)(?:\/|$)/,
  /^\/app\/(?:short|long)-rent\/settings(?:\/|$)/,
  /^\/app\/account\/billing(?:\/|$)/,
  /^\/app\/connect(?:\/|$)/,
  /^\/app\/short-rent\/integrations\/octorate(?:\/|$)/,
  /^\/app\/short-rent\/onboarding(?:\/|$)/,
  /^\/app\/(?:short|long)-rent\/profile(?:\/|$)/,
  /^\/profile(?:\/|$)/,
  /^\/legale(?:\/|$)/,
  /^\/onboarding(?:\/|$)/,
];

/**
 * Second, separate check after the wizard (consents stay a hard requirement of {@link needsOnboarding}): a host with
 * an org, a completed onboarding and a rental type but no property yet is taken to the creation of the first one,
 * not back to the whole wizard. Admins, suppliers and members without a rental type of their own (invited, so
 * not the ones who chose to set up a host org) are never sent there.
 */
export function needsFirstProperty(
  user: UserWithRoles,
  profile: OnboardingProfile | null | undefined,
  roles: string[] | undefined,
  pathname: string,
): boolean {
  const resolvedRoles = roles ?? getUserRoles(user);
  if (isExemptFromHostOnboarding(resolvedRoles) || isLinkedSupplier(profile)) return false;
  if (!profile?.orgId || !profile.rentalType) return false;
  if (needsOnboarding(user, profile, resolvedRoles)) return false;
  if (profile.hasProperties !== false) return false;
  return !FIRST_PROPERTY_EXEMPT_PATTERNS.some((pattern) => pattern.test(pathname));
}

export interface SetUpHostProfile extends OnboardingProfile {
  isActive?: boolean;
  commercialSetupRequired?: boolean | null;
}

/**
 * The rental type of a host the server has set up: an org, a finished onboarding, a rental type of its own, the current
 * consents and no payment waiting. Such a host owns its workspace through the persisted memberships, whatever the access token
 * says: the token is issued before the memberships exist and has no role claims until it is renewed, or never when the roles
 * could not be synced (`rolesSynced: false`). Back from the payment, the missing claims must not keep it on the onboarding.
 * `null` for anyone else (a supplier, an invited member with no rental type, a setup that is not finished or is withheld).
 */
export function getRentalTypeOfHostSetUpByServer(profile?: SetUpHostProfile | null): RentalType | null {
  if (!profile?.orgId || !profile.onboardingCompletedAt || !profile.rentalType) return null;
  if (profile.isActive === false || isLinkedSupplier(profile)) return null;
  if (profile.onboardingRequired === true || profile.consentsAccepted === false || profile.commercialSetupRequired === true) {
    return null;
  }
  return profile.rentalType;
}

const RENTAL_TYPE_CONTEXT_PREFIXES: Record<RentalType, string[]> = {
  ShortTerm: ['/app/short-rent'],
  LongTerm: ['/app/long-rent'],
  Both: ['/app/short-rent', '/app/long-rent'],
};

export function getFirstPropertyRoute(rentalType: RentalType): string {
  return rentalType === 'LongTerm' ? '/app/long-rent/properties/new?first=1' : '/app/short-rent/properties/create?first=1';
}

/**
 * Where to go once the onboarding is done: a deep page the guard redirected from when it belongs to a context the chosen
 * rental type opens; otherwise, right after the org was created (`firstRun`), guided setup when enabled or the first property;
 * otherwise the home of the rental type.
 */
export function getPostOnboardingRoute(
  rentalType: RentalType,
  from?: string | null,
  options?: { firstRun?: boolean; guidedSetup?: boolean },
): string {
  if (options?.firstRun && options.guidedSetup && rentalType !== 'LongTerm') {
    return '/app/short-rent/onboarding';
  }
  const prefixes = RENTAL_TYPE_CONTEXT_PREFIXES[rentalType] ?? [];
  if (from && prefixes.some((prefix) => from === prefix || from.startsWith(`${prefix}/`))) {
    if (!(options?.firstRun && prefixes.includes(from))) return from;
  }
  return options?.firstRun ? getFirstPropertyRoute(rentalType) : getHomeRouteForRentalType(rentalType);
}

export function getPlanPageForRentalType(rentalType: RentalType): string {
  return planPagePath(rentalType === 'LongTerm' ? 'long-rent' : 'short-rent');
}

export function getProfilePageForRentalType(rentalType: RentalType): string {
  return rentalType === 'LongTerm' ? '/app/long-rent/profile' : '/app/short-rent/profile';
}

export function getStaleConsentDocuments(error: unknown): string[] | null {
  if (!isAxiosError(error) || error.response?.status !== 400) return null;
  const data: unknown = error.response.data;
  if (typeof data !== 'object' || data === null || !('staleDocuments' in data)) return null;
  const { staleDocuments } = data;
  if (!Array.isArray(staleDocuments)) return null;
  const documents = staleDocuments.filter((value): value is string => typeof value === 'string');
  return documents.length > 0 ? documents : null;
}

/**
 * The onboarding was completed but a legal document changed since (backend `consentsAccepted: false`, PL-02): only
 * the consents step is needed, submitted with the rental type already chosen.
 */
export function needsConsentRenewal(profile?: OnboardingProfile | null): boolean {
  return lacksCurrentConsents(profile) && !!profile?.rentalType;
}

/**
 * The backend gate says the current legal documents are not accepted for the user's org, whatever the rental type. A plain
 * update (PUT, no consents) cannot fix it, so the wizard must collect the consents and POST: with no rental type yet it
 * asks the role first, then the documents. Treating it as an update there left the "Account e consensi" step open for
 * good (the update never records a consent).
 */
export function lacksCurrentConsents(profile?: OnboardingProfile | null): boolean {
  return !!profile?.orgId && !!profile.onboardingCompletedAt && profile.consentsAccepted === false;
}

export function canEditOnboarding(
  profile?: { orgId?: string | null; onboardingCompletedAt?: string | null } | null,
): boolean {
  if (!profile) return false;
  return !!profile.onboardingCompletedAt && !!profile.orgId;
}
