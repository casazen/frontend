/**
 * What the AI-generated content is, to word the notice: `generic` (a text written by AI), `seo` (a public guide that an
 * admin approved), `draft` (a draft waiting for the admin's review), `supplierReason` (why a supplier is recommended).
 */
export type AiContentKind = 'generic' | 'seo' | 'draft' | 'supplierReason';

/** Translation keys of the notices (`aiContentNotice.*`), one per kind. */
export const AI_CONTENT_NOTICE_KEYS: Record<AiContentKind, string> = {
  generic: 'aiContentNotice.label',
  seo: 'aiContentNotice.seo',
  draft: 'aiContentNotice.draft',
  supplierReason: 'aiContentNotice.supplierReason',
};
