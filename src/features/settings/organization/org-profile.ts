import type { OrgSettings } from '@/types';

export const ORG_NAME_FIELD_ID = 'org-name';

const PLACEHOLDER_ORG_NAME = 'la mia organizzazione';

const NEUTRAL_SLUG = /^org-[abcdefghijkmnpqrstuvwxyz23456789]{8}$/;

export function isOrgProfileIncomplete({ name, slug }: Pick<OrgSettings, 'name' | 'slug'>): boolean {
  const trimmedName = name.trim();
  return !trimmedName || trimmedName.toLowerCase() === PLACEHOLDER_ORG_NAME || !slug.trim() || NEUTRAL_SLUG.test(slug);
}
