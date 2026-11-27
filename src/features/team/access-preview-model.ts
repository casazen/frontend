import type { OrgRoleInfo } from '@/types/org-team.types';

export const PREVIEW_AREAS = ['short-rent', 'long-rent', 'account'] as const;

export type PreviewArea = (typeof PREVIEW_AREAS)[number];

const CAPABILITY_AREAS: Record<string, readonly PreviewArea[]> = {
  'short-rent': ['short-rent'],
  'long-rent': ['long-rent'],
  both: ['short-rent', 'long-rent'],
  account: ['account'],
};

export interface AccessPreviewModel {
  enters: PreviewArea[];
  stays: PreviewArea[];
  can: string[];
  read: string[];
  cannot: string[];
}

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
