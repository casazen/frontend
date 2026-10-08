import type { ContextBootstrapDto } from '@/api/contexts';

/**
 * Pseudo-permission of the org billing administrator: plan, subscription, billing portal and billing profile of the
 * org. Frontend mirror of the backend policy `OrgBillingAdmin` (TN-3, `OrgBillingAdminAuthorizationHandler`), which
 * is not among the context permissions of `/me/contexts`: the workspace `hasPermission` derives it from the contexts
 * of the user. It only decides what the menu shows; the backend stays the authority.
 */
export const ORG_BILLING_ADMIN_PERMISSION = 'org.billing.admin';

/**
 * Role keys of the memberships that pass the backend policy, per context (`OrgOwnerRoles`): the owner of either rental
 * context (the `property_owner` of short-rent, the `long_term_landlord` of long-rent, PL-16) and the platform admin.
 * A member of the org holds another role key of the same context (collaborator, property manager, accountant…): the
 * context alone says nothing, since a member has the context too (AM-00).
 */
const ORG_BILLING_ADMIN_ROLE_KEYS: ReadonlyMap<string, ReadonlySet<string>> = new Map([
  ['short-rent', new Set(['property_owner'])],
  ['long-rent', new Set(['long_term_landlord'])],
  ['admin', new Set(['platform_admin'])],
]);

/**
 * True when one of the contexts is held with the owner's (or the platform admin's) role key: the user may manage the
 * plan and the billing of its org. A membership with any other role key of the same context does not count.
 */
export function isOrgBillingAdmin(contexts: readonly Pick<ContextBootstrapDto, 'contextKey' | 'roleKey'>[]): boolean {
  return contexts.some((context) => ORG_BILLING_ADMIN_ROLE_KEYS.get(context.contextKey)?.has(context.roleKey) === true);
}
