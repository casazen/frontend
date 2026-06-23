import { env } from '@/config/env.config';

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
  contextKey: 'short-rent' | 'long-rent' | 'admin' | 'supplier';
  displayName: string;
  roleKey: string;
  permissions: string[];
  defaultRoute: string;
}

/** Parse Auth0 roles from an access-token JWT payload (roles live here, not in the ID token profile). */
export function parseRolesFromAccessToken(token: string | undefined | null): string[] {
  if (!token) return [];

  const parts = token.split('.');
  if (parts.length < 2) return [];

  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    const payload = JSON.parse(atob(padded)) as Record<string, unknown>;

    const fromCustomClaim = parseRolesClaimValue(payload[ROLES_CLAIM]);
    if (fromCustomClaim.length > 0) {
      return fromCustomClaim;
    }

    const audienceRoles = parseRolesClaimValue(payload[`${env.auth0.audience}/roles`]);
    if (audienceRoles.length > 0) {
      return audienceRoles;
    }

    return parseRolesClaimValue(payload.roles);
  } catch {
    return [];
  }
}

function parseRolesClaimValue(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((role): role is string => typeof role === 'string');
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed) as unknown;
        if (Array.isArray(parsed)) {
          return parsed.filter((role): role is string => typeof role === 'string');
        }
      } catch {
        return [];
      }
    }
    return trimmed.length > 0 ? [trimmed] : [];
  }

  return [];
}

export function deriveContextsFromAccessToken(token: string | undefined | null): DerivedContext[] {
  return deriveContextsFromRoles({ [ROLES_CLAIM]: parseRolesFromAccessToken(token) });
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

  if (roles.includes(ROLE_SUPPLIER)) {
    contexts.push({
      contextKey: 'supplier',
      displayName: 'Fornitore',
      roleKey: 'supplier',
      permissions: [
        'supplier.profile.read',
        'supplier.profile.write',
        'supplier.inbox.read',
        'supplier.availability.write',
      ],
      defaultRoute: '/app/supplier/inbox',
    });
  }

  return contexts;
}
