import type { ContextBootstrapDto } from '@/api/contexts';

/**
 * Pseudo-permission of the org billing administrator: plan, subscription, billing portal and billing profile of the
 * org. Frontend mirror of the backend policy `OrgBillingAdmin` (TN-3, `OrgBillingAdminAuthorizationHandler`), which
 * is not among the context permissions of `/me/contexts`: the workspace `hasPermission` derives it from the contexts
 * of the user. It only decides what the menu shows; the backend stays the authority.
 */
export const ORG_BILLING_ADMIN_PERMISSION = 'org.billing.admin';

/**
 * Contexts whose membership passes the backend policy: the owner of either rental context (short-rent host, long-term
 * landlord, PL-16) and the platform admin.
 */
const ORG_BILLING_ADMIN_CONTEXTS: ReadonlySet<string> = new Set(['short-rent', 'long-rent', 'admin']);

export function isOrgBillingAdmin(contexts: readonly Pick<ContextBootstrapDto, 'contextKey'>[]): boolean {
  return contexts.some((context) => ORG_BILLING_ADMIN_CONTEXTS.has(context.contextKey));
}
