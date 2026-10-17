import type { OrgRoleInfo } from '@/types/org-team.types';

/**
 * The roles the caller may give to a person: the matrix says which (`assignable`, about the caller: the owner gives every role but
 * its own, an administrator everything but the administrator), and the owner role is given to nobody. Nothing while the matrix is
 * still being read.
 */
export function assignableRoles(roles: readonly OrgRoleInfo[] | undefined): OrgRoleInfo[] {
  return (roles ?? []).filter((role) => role.assignable && role.role !== 'Owner');
}
