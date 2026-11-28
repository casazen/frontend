import type { OrgSiteDocumentKind } from '@/types';

export const ORG_DOCUMENT_SEGMENTS: Record<OrgSiteDocumentKind, string> = {
  privacy: 'privacy',
  terms: 'termini',
};

export function orgDocumentPath(orgSlug: string, kind: OrgSiteDocumentKind): string {
  return `/book/${encodeURIComponent(orgSlug)}/${ORG_DOCUMENT_SEGMENTS[kind]}`;
}
