import type { ContextBootstrapDto } from '@/api/contexts';
import type { AppContextKey, PermissionPredicate } from '@/config/route-manifest';
import { ORG_BILLING_ADMIN_PERMISSION, isOrgBillingAdmin } from '@/lib/org-billing-admin';
import { contextOf } from './org-contexts';

/**
 * What each role of the area of the host (Affitti brevi) holds in `GET /api/me/contexts`, as the backend seeds it (`OrgRoleCatalog.SeededRoles` and the owner of `AppDbContext`): the owner and the property manager
 * write the properties; the collaborator (`staff`) reads them and asks the suppliers for interventions (`servicerequest.write`), and never writes the properties; the accountant only reads. The role keys are the real
 * ones, so a test of a permission is a test of a role and never of a predicate that says yes.
 */
export const SHORT_RENT_ROLE_PERMISSIONS = {
  property_owner: ['property.read', 'property.write', 'booking.read', 'booking.write', 'payment.read', 'payment.write', 'guest.read', 'guest.write', 'servicerequest.write'],
  property_manager: ['property.read', 'property.write', 'booking.read', 'booking.write', 'payment.read', 'payment.write', 'guest.read', 'guest.write', 'servicerequest.write', 'approval.decide'],
  staff: ['property.read', 'booking.read', 'guest.read', 'guest.write', 'servicerequest.write'],
  accountant: ['property.read', 'booking.read', 'payment.read'],
} as const satisfies Record<string, readonly string[]>;

export type ShortRentRoleKey = keyof typeof SHORT_RENT_ROLE_PERMISSIONS;

export const SHORT_RENT_ROLE_KEYS = Object.keys(SHORT_RENT_ROLE_PERMISSIONS) as ShortRentRoleKey[];

export function hostContextsOf(roleKey: ShortRentRoleKey): ContextBootstrapDto[] {
  return [contextOf('short-rent', roleKey, [...SHORT_RENT_ROLE_PERMISSIONS[roleKey]])];
}

export function workspacePredicateOf(contexts: readonly ContextBootstrapDto[]): PermissionPredicate {
  return (contextKey: AppContextKey, permission: string) => {
    const context = contexts.find((candidate) => candidate.contextKey === contextKey);
    if (!context) return false;
    if (!permission) return true;
    if (permission === ORG_BILLING_ADMIN_PERMISSION) return isOrgBillingAdmin(contexts);
    return context.permissions.includes(permission);
  };
}
