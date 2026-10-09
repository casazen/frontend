import type { ContextBootstrapDto } from '@/api/contexts';
import type { AppContextKey } from '@/config/route-manifest';

/**
 * Role key the owner of each context holds in `GET /api/me/contexts` (backend `OrgOwnerRoles` and the migration seed).
 * Only these pass `isOrgBillingAdmin`: a member of the org holds another role key of the same context (AM-00).
 */
export const OWNER_ROLE_KEY: Readonly<Record<AppContextKey, string>> = {
  'short-rent': 'property_owner',
  'long-rent': 'long_term_landlord',
  admin: 'platform_admin',
  supplier: 'supplier',
};

/** Role keys a member of the org (not its owner) holds in a rental context. */
export const MEMBER_ROLE_KEYS = ['property_manager', 'staff', 'accountant', 'bk09_collaborator'] as const;

/**
 * A context of the user as the API returns it: held as the owner by default, or with `roleKey` (a member of the org).
 */
export function contextOf(
  contextKey: AppContextKey,
  roleKey: string = OWNER_ROLE_KEY[contextKey],
  permissions: string[] = [],
): ContextBootstrapDto {
  return { contextKey, displayName: contextKey, roleKey, permissions, defaultRoute: `/app/${contextKey}` };
}
