import type { OrgSettings } from '@/types';

/** Id of the field with the name of the org: the account page takes the person there when the profile is not filled in. */
export const ORG_NAME_FIELD_ID = 'org-name';

/** The name a new org gets until its owner chooses one (backend `Org.PlaceholderName`). */
const PLACEHOLDER_ORG_NAME = 'la mia organizzazione';

/** The address CasaZen generates for a new org: `org-` and eight characters of its alphabet (backend `OrgSlugHelper.IsNeutral`). */
const NEUTRAL_SLUG = /^org-[abcdefghijkmnpqrstuvwxyz23456789]{8}$/;

/**
 * The name and the address of the booking site are still the ones CasaZen gave the org (or are empty): the same test the backend
 * makes for the "organization" step of the activation checklist, so the page and the checklist agree on what is left to do.
 */
export function isOrgProfileIncomplete({ name, slug }: Pick<OrgSettings, 'name' | 'slug'>): boolean {
  const trimmedName = name.trim();
  return !trimmedName || trimmedName.toLowerCase() === PLACEHOLDER_ORG_NAME || !slug.trim() || NEUTRAL_SLUG.test(slug);
}
