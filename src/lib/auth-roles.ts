export const ROLES_CLAIM = 'https://casazen.app/roles';

type UserWithRoles = Record<string, unknown> | null | undefined;

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
