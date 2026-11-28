import type { OrgCapabilityLevel, OrgRoleInfo } from '@/types/org-team.types';
import { buildAccessPreview } from './access-preview-model';

export function assignableRoles(roles: readonly OrgRoleInfo[] | undefined): OrgRoleInfo[] {
  return (roles ?? []).filter((role) => role.assignable && role.role !== 'Owner');
}

const RANK: Record<OrgCapabilityLevel, number> = { No: 0, Read: 1, Yes: 2 };

export interface RoleChange {
  id: string;
  level: OrgCapabilityLevel;
}

function levelsOf(role: OrgRoleInfo, areas: readonly string[]): Map<string, OrgCapabilityLevel> {
  const model = buildAccessPreview(role, areas);
  const levels = new Map<string, OrgCapabilityLevel>();
  for (const id of model.can) levels.set(id, 'Yes');
  for (const id of model.read) levels.set(id, 'Read');
  for (const id of model.cannot) levels.set(id, 'No');
  return levels;
}

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
