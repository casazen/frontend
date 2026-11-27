import type { StarterContent } from '@/lib/supplier-site/starter-content';
import type { ShowcaseDocument } from '@/types/supplier-showcase';
import type { DraftPatch } from './use-showcase-draft';

const empty = (value: string | null | undefined) => (value ?? '').trim() === '';

export interface StarterFill {
  patch: DraftPatch;
  inverse: DraftPatch;
}

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
