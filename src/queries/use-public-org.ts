import { useQuery } from '@tanstack/react-query';
import { publicOrgApi } from '@/api/public-org.api';
import type { OrgSiteDocumentKind } from '@/types';

export function usePublicOrg(slug: string | undefined) {
  return useQuery({
    queryKey: ['public-org', slug],
    queryFn: () => publicOrgApi.getPublicOrg(slug!),
    enabled: Boolean(slug),
    retry: false,
  });
}

export function useOrgProperties(slug: string | undefined) {
  return useQuery({
    queryKey: ['public-org-properties', slug],
    queryFn: () => publicOrgApi.getOrgProperties(slug!),
    enabled: Boolean(slug),
  });
}

/**
 * The public detail of a home. With `fresh` the page that shows it asks the server again every time it opens, whatever the age of the answer it already has
 * (it is shown at once and corrected when the new one comes): a page that stays open while the guest moves between homes (the property widget of a frame) must
 * not show a home that was unpublished, or is no longer bookable online, from an older answer. The default of the app keeps an answer for five minutes and never
 * asks again on mount, which is right for the page of the site that is loaded afresh at each visit.
 */
export function useOrgPublicProperty(slug: string | undefined, propertyId: string | undefined, { fresh = false }: { fresh?: boolean } = {}) {
  return useQuery({
    queryKey: ['public-org-property', slug, propertyId],
    queryFn: () => publicOrgApi.getOrgProperty(slug!, propertyId!),
    enabled: Boolean(slug && propertyId),
    retry: false,
    ...(fresh ? { staleTime: 0, refetchOnMount: 'always' as const } : {}),
  });
}

/** BK-14: the operator's privacy notice or booking terms of an org's public site. */
export function useOrgDocument(slug: string | undefined, kind: OrgSiteDocumentKind) {
  return useQuery({
    queryKey: ['public-org-document', slug, kind],
    queryFn: () => publicOrgApi.getOrgDocument(slug!, kind),
    enabled: Boolean(slug),
    retry: false,
  });
}
