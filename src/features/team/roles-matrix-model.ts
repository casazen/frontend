import type { OrgCapabilityLevel, OrgMember, OrgRole, OrgRoleInfo } from '@/types/org-team.types';

/** The groups of the matrix in the order a person reads them: the two rental areas, what both share (the suppliers' interventions), the Amministrazione. */
const GROUP_ORDER: readonly string[] = ['short-rent', 'long-rent', 'both', 'account'];

/** One capability of the matrix and what each role does with it. A role the backend sends no line for does nothing with it. */
export interface MatrixRow {
  id: string;
  levels: Partial<Record<OrgRole, OrgCapabilityLevel>>;
}

/** The capabilities of one group (`short-rent`, `long-rent`, `both`, `account`), in the order of the matrix. */
export interface MatrixGroup {
  group: string;
  rows: MatrixRow[];
}

/**
 * The matrix the backend sends (`GET /api/orgs/me/roles`: one list of capabilities for each role) turned the other way round, for a
 * table: one row for each capability, in the order the backend gives them, with the level each role has, and the rows gathered by group.
 * A group this version of the app does not know is kept, after the known ones, instead of being dropped.
 */
export function buildRoleMatrix(roles: readonly OrgRoleInfo[]): MatrixGroup[] {
  const rows = new Map<string, MatrixRow & { group: string }>();
  for (const info of roles) {
    for (const capability of info.capabilities) {
      const row = rows.get(capability.id) ?? { id: capability.id, group: capability.group, levels: {} };
      row.levels[info.role] = capability.level;
      rows.set(capability.id, row);
    }
  }

  const groups = new Map<string, MatrixRow[]>();
  for (const { group, ...row } of rows.values()) {
    groups.set(group, [...(groups.get(group) ?? []), row]);
  }

  const rank = (group: string) => {
    const index = GROUP_ORDER.indexOf(group);
    return index === -1 ? GROUP_ORDER.length : index;
  };
  return [...groups.entries()].map(([group, groupRows]) => ({ group, rows: groupRows })).sort((a, b) => rank(a.group) - rank(b.group));
}

/** What one role does with the capabilities of the matrix, gathered by level (for the cards of a narrow screen), in the order of the matrix. */
export function capabilitiesByLevel(groups: readonly MatrixGroup[], role: OrgRole): Record<OrgCapabilityLevel, string[]> {
  const byLevel: Record<OrgCapabilityLevel, string[]> = { Yes: [], Read: [], No: [] };
  for (const group of groups) {
    for (const row of group.rows) byLevel[row.levels[role] ?? 'No'].push(row.id);
  }
  return byLevel;
}

/** How many people work in the org with each role: the ones whose access is on (an invitation is not a person yet). */
export function countPeopleByRole(members: readonly Pick<OrgMember, 'role' | 'status'>[] | undefined): Partial<Record<OrgRole, number>> {
  const counts: Partial<Record<OrgRole, number>> = {};
  for (const member of members ?? []) {
    if (member.status === 'Active') counts[member.role] = (counts[member.role] ?? 0) + 1;
  }
  return counts;
}
