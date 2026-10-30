import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { publicBookingApi } from '@/api/public-booking.api';
import { publicSiteSearchApi } from '@/api/public-site-search.api';
import { publicReviewsApi } from '@/api/reviews.api';
import { retryTransientErrors } from '@/lib/query-client';
import type { DirectBookingQuotePayload } from '@/types';
import type { PublicStaysQuery } from '@/types/public-stays.types';

/** The server keeps an answer of the search for a few seconds: asking the same again before then costs nothing. */
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
