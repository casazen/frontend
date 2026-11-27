export type AiContentKind = 'generic' | 'seo' | 'draft' | 'supplierReason';

export const AI_CONTENT_NOTICE_KEYS: Record<AiContentKind, string> = {
  generic: 'aiContentNotice.label',
  seo: 'aiContentNotice.seo',
  draft: 'aiContentNotice.draft',
  supplierReason: 'aiContentNotice.supplierReason',
};
