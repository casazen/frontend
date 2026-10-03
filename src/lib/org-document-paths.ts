import type { OrgSiteDocumentKind } from '@/types';

/**
 * Public pages of the operator's own documents (BK-14, A3-21): the host's privacy notice and booking terms, under the
 * org's booking site. Not the CasaZen documents (`/legale/*`, PL-14). The org slug in the path may be an old slug of the
 * org: the site shell redirects it to the current one (PL-04).
 */
export const ORG_DOCUMENT_SEGMENTS: Record<OrgSiteDocumentKind, string> = {
  privacy: 'privacy',
  terms: 'termini',
};

export function orgDocumentPath(orgSlug: string, kind: OrgSiteDocumentKind): string {
  return `/book/${encodeURIComponent(orgSlug)}/${ORG_DOCUMENT_SEGMENTS[kind]}`;
}
