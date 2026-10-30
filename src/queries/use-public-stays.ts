import { useMemo } from 'react';
import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { publicBookingApi } from '@/api/public-booking.api';
import { publicSiteSearchApi } from '@/api/public-site-search.api';
import { publicReviewsApi } from '@/api/reviews.api';
import { retryTransientErrors } from '@/lib/query-client';
import type { DirectBookingQuotePayload } from '@/types';
import type { PublicStaysQuery, PublicStaysResult } from '@/types/public-stays.types';

/** The server keeps an answer of the search for a few seconds: asking the same again before then costs nothing. */
const STAYS_STALE_MS = 30_000;

/** The query without the parts left empty, so that the same search is always the same key (and the same address of the call). */
export function cleanStaysQuery(query: PublicStaysQuery): PublicStaysQuery {
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '' || value === false) continue;
    clean[key] = value;
  }
  return clean as PublicStaysQuery;
}

interface StaysOptions {
  enabled?: boolean;
  /** Keep showing the previous answer while the next one is on its way (a filter that moves under the finger). */
  keepPrevious?: boolean;
}

/** Every published home of a booking site for a stay and some filters (DB-07a): one call, never one per home. */
export function useOrgStays(slug: string | undefined, query: PublicStaysQuery, { enabled = true, keepPrevious = false }: StaysOptions = {}) {
  const clean = cleanStaysQuery(query);
  return useQuery({
    queryKey: ['public-stays', slug, clean] as const,
    queryFn: () => publicSiteSearchApi.getStays(slug!, clean),
    enabled: Boolean(slug) && enabled,
    staleTime: STAYS_STALE_MS,
    // The app does not refetch on mount by default; what is free changes, so an answer older than the server's own is asked again.
    refetchOnMount: true,
    placeholderData: keepPrevious ? keepPreviousData : undefined,
    retry: retryTransientErrors(2),
  });
}

/** Homes of a page of the search across all the sites (the server's own default). */
export const PLATFORM_PAGE_SIZE = 24;

/**
 * The free homes of ALL the booking sites for a stay and some filters (the public `/search`), a page at a time: the pages loaded so far
 * are one list (`data.items`), the counts, the nearby dates and the facets are those of the first page. `hasNextPage` / `fetchNextPage`
 * load the next one. `pageSize` 1 is the cheap way to ask only how many homes a draft of the filters leaves.
 */
export function usePlatformStays(
  query: PublicStaysQuery,
  { enabled = true, keepPrevious = false, pageSize = PLATFORM_PAGE_SIZE }: StaysOptions & { pageSize?: number } = {},
) {
  const clean = cleanStaysQuery({ ...query, page: undefined, pageSize });
  const infinite = useInfiniteQuery({
    queryKey: ['public-platform-stays', clean] as const,
    queryFn: ({ pageParam }) => publicSiteSearchApi.getPlatformStays(pageParam > 1 ? { ...clean, page: pageParam } : clean),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page * last.pageSize < last.availableCount ? last.page + 1 : undefined),
    enabled,
    staleTime: STAYS_STALE_MS,
    refetchOnMount: true,
    placeholderData: keepPrevious ? keepPreviousData : undefined,
    retry: retryTransientErrors(2),
  });

  const pages = infinite.data?.pages;
  const data = useMemo<PublicStaysResult | undefined>(
    () => (pages && pages.length > 0 ? { ...pages[0], items: pages.flatMap((page) => page.items) } : undefined),
    [pages],
  );
  const { isPending, isError, isFetching, isPlaceholderData, refetch, hasNextPage, fetchNextPage, isFetchingNextPage } = infinite;
  return { data, isPending, isError, isFetching, isPlaceholderData, refetch, hasNextPage, fetchNextPage, isFetchingNextPage };
}

/** The places of all the sites, for the «Dove» field of the search across them. */
export function usePlatformDestinations(enabled = true) {
  return useQuery({
    queryKey: ['public-platform-destinations'] as const,
    queryFn: () => publicSiteSearchApi.getPlatformDestinations(),
    enabled,
    staleTime: 5 * 60_000,
    retry: retryTransientErrors(1),
  });
}

/** The places of the site, for the «Dove» field. */
export function useOrgDestinations(slug: string | undefined) {
  return useQuery({
    queryKey: ['public-destinations', slug] as const,
    queryFn: () => publicSiteSearchApi.getDestinations(slug!),
    enabled: Boolean(slug),
    staleTime: 5 * 60_000,
    retry: retryTransientErrors(1),
  });
}

/** The price of a stay as the checkout will ask it, broken down: the quote of the server, never worked out on the page. */
export function usePublicStayQuote(payload: DirectBookingQuotePayload | null) {
  return useQuery({
    queryKey: ['public-stay-quote', payload] as const,
    queryFn: () => publicBookingApi.quoteDirectBooking(payload!),
    enabled: payload !== null,
    staleTime: 5 * 60_000,
    retry: retryTransientErrors(1),
  });
}

/** The first reviews of a home of the site, newest first (the section «Cosa dicono gli ospiti» of the home). */
export function usePublicReviewsPreview(orgSlug: string | undefined, propertyId: string | undefined, count: number) {
  return useQuery({
    queryKey: ['public-reviews-preview', orgSlug, propertyId, count] as const,
    queryFn: () => publicReviewsApi.list(orgSlug!, propertyId!, 1, count),
    enabled: Boolean(orgSlug && propertyId),
    staleTime: 5 * 60_000,
    retry: retryTransientErrors(1),
  });
}
