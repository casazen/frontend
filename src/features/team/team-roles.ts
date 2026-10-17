import type { OrgCapabilityLevel, OrgRoleInfo } from '@/types/org-team.types';
import { buildAccessPreview } from './access-preview-model';

/**
 * The roles the caller may give to a person: the matrix says which (`assignable`, about the caller: the owner gives every role but
 * its own, an administrator everything but the administrator), and the owner role is given to nobody. Nothing while the matrix is
 * still being read.
 */
export function assignableRoles(roles: readonly OrgRoleInfo[] | undefined): OrgRoleInfo[] {
  return (roles ?? []).filter((role) => role.assignable && role.role !== 'Owner');
}

const RANK: Record<OrgCapabilityLevel, number> = { No: 0, Read: 1, Yes: 2 };

/** What one capability becomes with the new role: the capability and the level it ends at. */
export interface RoleChange {
  id: string;
  level: OrgCapabilityLevel;
}

/** What a capability is for a role and the areas of a person: the level it has there, `No` for what is not even in the areas it enters. */
function levelsOf(role: OrgRoleInfo, areas: readonly string[]): Map<string, OrgCapabilityLevel> {
  const model = buildAccessPreview(role, areas);
  const levels = new Map<string, OrgCapabilityLevel>();
  for (const id of model.can) levels.set(id, 'Yes');
  for (const id of model.read) levels.set(id, 'Read');
  for (const id of model.cannot) levels.set(id, 'No');
  return levels;
}

/**
 * What changes for a person who goes from the role `from` to `to`, working in `areas`: the capabilities that get better (more) and
 * the ones that get worse (less), each with the level it ends at, in the order of the matrix. A capability of an area the person
 * does not enter does not count, and one of the Amministrazione counts only for a role that has it (the matrix `permissionsByContext`).
 */
export function roleChanges(from: OrgRoleInfo, to: OrgRoleInfo, areas: readonly string[]): { more: RoleChange[]; less: RoleChange[] } {
  const before = levelsOf(from, areas);
  const after = levelsOf(to, areas);
  const ids = [...new Set([...to.capabilities, ...from.capabilities].map((capability) => capability.id))];

  const more: RoleChange[] = [];
  const less: RoleChange[] = [];
  for (const id of ids) {
    const was = before.get(id) ?? 'No';
    const now = after.get(id) ?? 'No';
    if (RANK[now] > RANK[was]) more.push({ id, level: now });
    else if (RANK[now] < RANK[was]) less.push({ id, level: now });
  }
  return { more, less };
}
