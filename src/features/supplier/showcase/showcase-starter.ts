import type { StarterContent } from '@/lib/supplier-site/starter-content';
import type { ShowcaseDocument } from '@/types/supplier-showcase';
import type { DraftPatch } from './use-showcase-draft';

const empty = (value: string | null | undefined) => (value ?? '').trim() === '';

/** What a starter would fill in: the members of the draft that are still empty, and nothing that the supplier wrote. */
export interface StarterFill {
  patch: DraftPatch;
  /** The same members as they are now, to put back with "Annulla" (a member that was missing goes back to missing). */
  inverse: DraftPatch;
}

/** The patch that puts the starter in the empty members of the draft, or null when there is nothing empty (nothing to offer). */
export function starterFill(doc: ShowcaseDocument, starter: StarterContent): StarterFill | null {
  const patch: DraftPatch = {};
  const inverse: DraftPatch = {};
  if (empty(doc.tagline)) {
    patch.tagline = starter.tagline;
    inverse.tagline = doc.tagline ?? null;
  }
  if (empty(doc.intro)) {
    patch.intro = starter.intro;
    inverse.intro = doc.intro ?? null;
  }
  if ((doc.prep ?? []).every(empty)) {
    patch.prep = [...starter.prep];
    inverse.prep = doc.prep && doc.prep.length > 0 ? doc.prep : null;
  }
  return Object.keys(patch).length > 0 ? { patch, inverse } : null;
}
