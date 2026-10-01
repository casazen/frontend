import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { LegalApi } from '@/api/legal.api';

/** Prefix of the legal document queries (ToS, privacy, DPA, subprocessors). */
export const LEGAL_QUERY_KEY = ['legal'] as const;

export function useLegalDocuments() {
  const tos = useQuery({ queryKey: ['legal', 'tos'], queryFn: () => LegalApi.getTos() });
  const privacy = useQuery({ queryKey: ['legal', 'privacy'], queryFn: () => LegalApi.getPrivacy() });
  const dpa = useQuery({ queryKey: ['legal', 'dpa'], queryFn: () => LegalApi.getDpa() });
  const subprocessors = useQuery({
    queryKey: ['legal', 'subprocessors'],
    queryFn: () => LegalApi.getSubprocessors(),
  });
  const queries = [tos, privacy, dpa, subprocessors];

  const isLoading = queries.some((query) => query.isLoading);
  const isError = queries.some((query) => query.isError);
  // A1-39: the failed documents are loaded again on request, the others are kept.
  const isRetrying = queries.some((query) => query.isError && query.isFetching);
  const retry = () => {
    queries.forEach((query) => {
      if (query.isError) void query.refetch();
    });
  };

  return {
    tos: tos.data,
    privacy: privacy.data,
    dpa: dpa.data,
    subprocessors: subprocessors.data,
    isLoading,
    isError,
    isRetrying,
    retry,
  };
}

/**
 * Drops the cached legal documents and loads them again (A1-39): after a 400 `staleDocuments` the versions held by the
 * page are outdated, and the consents step must show the current ones (loading state included) before a new attempt.
 */
export function useReloadLegalDocuments() {
  const queryClient = useQueryClient();
  return useCallback(() => queryClient.resetQueries({ queryKey: LEGAL_QUERY_KEY }), [queryClient]);
}

const LEGAL_LINKS_STALE_MS = 60 * 60 * 1000;

function httpUrl(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Links of the CasaZen Terms and Privacy documents for the public footer (D3, SE-03): the `documentUrl` the backend
 * serves from its configuration (`Legal__Documents__Tos__DocumentUrl`, `…__Privacy__…`, texts provided by the product
 * owner, D14). `undefined` while loading, on error or when not configured: the footer then shows no link rather than a
 * link to a page that does not exist.
 */
export function usePlatformLegalLinks() {
  const tos = useQuery({ queryKey: ['legal', 'tos'], queryFn: () => LegalApi.getTos(), staleTime: LEGAL_LINKS_STALE_MS });
  const privacy = useQuery({
    queryKey: ['legal', 'privacy'],
    queryFn: () => LegalApi.getPrivacy(),
    staleTime: LEGAL_LINKS_STALE_MS,
  });

  return {
    termsUrl: httpUrl(tos.data?.documentUrl),
    privacyUrl: httpUrl(privacy.data?.documentUrl),
  };
}
