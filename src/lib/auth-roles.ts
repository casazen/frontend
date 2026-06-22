export const ROLES_CLAIM = 'https://casazen.app/roles';

export const ROLE_PROPERTY_OWNER = 'PropertyOwner';
export const ROLE_LONG_TERM_LANDLORD = 'LongTermLandlord';
export const ROLE_ADMIN = 'Admin';
export const ROLE_SUPPLIER = 'Supplier';

export type UserWithRoles = Record<string, unknown> | null | undefined;

export function getUserRoles(user: UserWithRoles): string[] {
  if (!user) return [];

  const roles = user[ROLES_CLAIM];
  if (Array.isArray(roles)) {
    return roles.filter((role): role is string => typeof role === 'string');
  }

  if (Array.isArray(user.roles)) {
    return user.roles.filter((role): role is string => typeof role === 'string');
  }

  return [];
}

export function hasRole(user: UserWithRoles, role: string): boolean {
  return getUserRoles(user).includes(role);
}

export function isShortStayOnly(user: UserWithRoles): boolean {
  return hasRole(user, ROLE_PROPERTY_OWNER) && !hasRole(user, ROLE_LONG_TERM_LANDLORD);
}

export function isLongTermOnly(user: UserWithRoles): boolean {
  return hasRole(user, ROLE_LONG_TERM_LANDLORD) && !hasRole(user, ROLE_PROPERTY_OWNER);
}

export function isDualRole(user: UserWithRoles): boolean {
  return hasRole(user, ROLE_PROPERTY_OWNER) && hasRole(user, ROLE_LONG_TERM_LANDLORD);
}

export function isAdmin(user: UserWithRoles): boolean {
  return hasRole(user, ROLE_ADMIN);
}

export interface DerivedContext {
  contextKey: 'short-rent' | 'long-rent' | 'admin';
  displayName: string;
  roleKey: string;
  permissions: string[];
  defaultRoute: string;
}

export function deriveContextsFromRoles(user: UserWithRoles): DerivedContext[] {
  const roles = getUserRoles(user);
  const contexts: DerivedContext[] = [];

  if (roles.includes(ROLE_PROPERTY_OWNER)) {
    contexts.push({
      contextKey: 'short-rent',
      displayName: 'Affitti brevi',
      roleKey: 'property_owner',
      permissions: [
        'property.read',
        'property.write',
        'booking.read',
        'booking.write',
        'payment.read',
        'payment.write',
        'ota.read',
        'ota.write',
        'guest.read',
        'guest.write',
      ],
      defaultRoute: '/app/short-rent',
    });
  }

  if (roles.includes(ROLE_LONG_TERM_LANDLORD)) {
    contexts.push({
      contextKey: 'long-rent',
      displayName: 'Affitti lungo termine',
      roleKey: 'long_term_landlord',
      permissions: ['lease.read', 'lease.create', 'lease.sign', 'lease.register'],
      defaultRoute: '/app/long-rent/leases',
    });
  }

  if (roles.includes(ROLE_ADMIN)) {
    contexts.push({
      contextKey: 'admin',
      displayName: 'Amministrazione',
      roleKey: 'platform_admin',
      permissions: [
        'admin.stats.read',
        'admin.users.read',
        'admin.users.manage',
        'admin.cin.read',
        'admin.jobs.read',
        'admin.seo.read',
        'admin.tax.manage',
      ],
      defaultRoute: '/app/admin',
    });
  }

  return contexts;
}
