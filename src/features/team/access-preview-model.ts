import type { OrgRoleInfo } from '@/types/org-team.types';

/** The areas a person can work in, in the order of the area switcher. `account` is the Amministrazione: the role gives it, not the person's areas. */
const PREVIEW_AREAS = ['short-rent', 'long-rent', 'account'] as const;

export type PreviewArea = (typeof PREVIEW_AREAS)[number];

/** The areas a capability of the matrix belongs to: `both` is the interventions of the suppliers, valid in either rental area. */
const CAPABILITY_AREAS: Record<string, readonly PreviewArea[]> = {
  'short-rent': ['short-rent'],
  'long-rent': ['long-rent'],
  both: ['short-rent', 'long-rent'],
  account: ['account'],
};

/** What a person sees: the areas it can enter and what its role does in them. */
export interface AccessPreviewModel {
  /** The areas the person can enter. */
  enters: PreviewArea[];
  /** The areas it cannot: a rental area it was not given, or the Amministrazione when its role has none. */
  stays: PreviewArea[];
  /** The ids of the capabilities of the areas it enters, in the order of the matrix, by what the role does with them. */
  can: string[];
  read: string[];
  cannot: string[];
}

/**
 * What a person with this role and these areas can see and do, from the matrix the backend sends (`GET /api/orgs/me/roles`): the
 * role says *what* (the level of each capability), the areas say *where*. A capability counts only in the areas the person
 * enters, so a person without Affitti lunghi is not told what its role cannot do with leases.
 */
export function buildAccessPreview(role: OrgRoleInfo, areas: readonly string[]): AccessPreviewModel {
  const enters = PREVIEW_AREAS.filter((area) => (area === 'account' ? Object.hasOwn(role.permissionsByContext, 'account') : areas.includes(area)));
  const stays = PREVIEW_AREAS.filter((area) => !enters.includes(area));
  const model: AccessPreviewModel = { enters, stays, can: [], read: [], cannot: [] };

  for (const capability of role.capabilities) {
    const belongsTo = Object.hasOwn(CAPABILITY_AREAS, capability.group) ? CAPABILITY_AREAS[capability.group] : [];
    if (!belongsTo.some((area) => enters.includes(area))) continue;
    const bucket = capability.level === 'Yes' ? model.can : capability.level === 'Read' ? model.read : model.cannot;
    bucket.push(capability.id);
  }
  return model;
}
