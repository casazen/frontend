import type { ContextBootstrapDto } from '@/api/contexts';

export const ORG_BILLING_ADMIN_PERMISSION = 'org.billing.admin';

/**
 * Role keys of the memberships that pass the backend policy, per context (`OrgOwnerRoles`): the owner of either rental
 * context (the `property_owner` of short-rent, the `long_term_landlord` of long-rent, PL-16), the owner and the
 * administrator of the account context (`org_owner`, `org_admin`: the two roles that hold `org.billing.manage`, AM-01) and
 * the platform admin. A member of the org holds another role key of the same context (collaborator, property manager,
 * accountant…): the context alone says nothing, since a member has the context too (AM-00).
 */
const ORG_BILLING_ADMIN_ROLE_KEYS: ReadonlyMap<string, ReadonlySet<string>> = new Map([
  ['short-rent', new Set(['property_owner'])],
  ['long-rent', new Set(['long_term_landlord'])],
  ['account', new Set(['org_owner', 'org_admin'])],
  ['admin', new Set(['platform_admin'])],
]);

export function isOrgBillingAdmin(contexts: readonly Pick<ContextBootstrapDto, 'contextKey' | 'roleKey'>[]): boolean {
  return contexts.some((context) => ORG_BILLING_ADMIN_ROLE_KEYS.get(context.contextKey)?.has(context.roleKey) === true);
}

export function hasAccountBillingPage(contexts: readonly Pick<ContextBootstrapDto, 'contextKey' | 'roleKey'>[]): boolean {
  return isOrgBillingAdmin(contexts) && contexts.some((context) => context.contextKey === 'account');
}
