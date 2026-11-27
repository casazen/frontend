import { useMemo } from 'react';
import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { publicBookingApi } from '@/api/public-booking.api';
import { publicSiteSearchApi } from '@/api/public-site-search.api';
import { publicReviewsApi } from '@/api/reviews.api';
import { retryTransientErrors } from '@/lib/query-client';
import type { DirectBookingQuotePayload } from '@/types';
import type { PublicStaysQuery, PublicStaysResult } from '@/types/public-stays.types';

const STAYS_STALE_MS = 30_000;

/**
 * The query without the parts left empty, so that the same search is always the same key (and the same address of the call).
 * The server refuses a stay with only one of its two dates (422 `public_stays_dates_invalid`), and a guest who has chosen the
 * arrival has not chosen the departure yet: until both are there the homes are asked for without dates, never with half of them.
 */
export function cleanStaysQuery(query: PublicStaysQuery): PublicStaysQuery {
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '' || value === false) continue;
    clean[key] = value;
  }
  if (!clean.checkIn || !clean.checkOut) {
    delete clean.checkIn;
    delete clean.checkOut;
  }
  return clean as PublicStaysQuery;
}

interface StaysOptions {
  enabled?: boolean;
  keepPrevious?: boolean;
}

export function useOrgStays(slug: string | undefined, query: PublicStaysQuery, { enabled = true, keepPrevious = false }: StaysOptions = {}) {
  const clean = cleanStaysQuery(query);
  return useQuery({
    queryKey: ['public-stays', slug, clean] as const,
    queryFn: () => publicSiteSearchApi.getStays(slug!, clean),
    enabled: Boolean(slug) && enabled,
    staleTime: STAYS_STALE_MS,
    refetchOnMount: true,
    placeholderData: keepPrevious ? keepPreviousData : undefined,
    retry: retryTransientErrors(2),
  });
}

const PLATFORM_PAGE_SIZE = 24;

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

export function usePlatformDestinations(enabled = true) {
  return useQuery({
    queryKey: ['public-platform-destinations'] as const,
    queryFn: () => publicSiteSearchApi.getPlatformDestinations(),
    enabled,
    staleTime: 5 * 60_000,
    retry: retryTransientErrors(1),
  });
}

export function useOrgDestinations(slug: string | undefined, options: { fresh?: boolean } = {}) {
  return useQuery({
    queryKey: ['public-destinations', slug] as const,
    queryFn: () => publicSiteSearchApi.getDestinations(slug!),
    enabled: Boolean(slug),
    staleTime: options.fresh ? 0 : 5 * 60_000,
    ...(options.fresh ? { refetchOnMount: 'always' as const } : {}),
    retry: retryTransientErrors(1),
  });
}

export function usePublicStayQuote(payload: DirectBookingQuotePayload | null) {
  return useQuery({
    queryKey: ['public-stay-quote', payload] as const,
    queryFn: () => publicBookingApi.quoteDirectBooking(payload!),
    enabled: payload !== null,
    staleTime: 5 * 60_000,
    retry: retryTransientErrors(1),
  });
}

export function usePublicReviewsPreview(orgSlug: string | undefined, propertyId: string | undefined, count: number) {
  return useQuery({
    queryKey: ['public-reviews-preview', orgSlug, propertyId, count] as const,
    queryFn: () => publicReviewsApi.list(orgSlug!, propertyId!, 1, count),
    enabled: Boolean(orgSlug && propertyId),
    staleTime: 5 * 60_000,
    retry: retryTransientErrors(1),
  });
}
