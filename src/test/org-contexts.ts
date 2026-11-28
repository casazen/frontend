import type { ContextBootstrapDto } from '@/api/contexts';
import type { AppContextKey } from '@/config/route-manifest';

export const OWNER_ROLE_KEY: Readonly<Record<AppContextKey, string>> = {
  'short-rent': 'property_owner',
  'long-rent': 'long_term_landlord',
  admin: 'platform_admin',
  supplier: 'supplier',
};

export const MEMBER_ROLE_KEYS = ['property_manager', 'staff', 'accountant', 'bk09_collaborator'] as const;

export function contextOf(
  contextKey: AppContextKey,
  roleKey: string = OWNER_ROLE_KEY[contextKey],
  permissions: string[] = [],
): ContextBootstrapDto {
  return { contextKey, displayName: contextKey, roleKey, permissions, defaultRoute: `/app/${contextKey}` };
}
