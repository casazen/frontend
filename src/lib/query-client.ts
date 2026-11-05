import { MutationCache, QueryClient } from '@tanstack/react-query';
import { isTransientRequestError } from '@/lib/api-errors';

/** Retries after the first failure for queries: 2 (so at most 3 attempts). */
export const MAX_QUERY_RETRIES = 2;

/** Root of the query keys of the internal activities: the staff work and the "To do" list (ADR-026). */
export const INTERNAL_ACTIVITIES_KEY = 'internal-activities';

/**
 * React Query `retry` predicate: retries only transient failures (network errors, timeouts,
 * 5xx except 501), up to `maxRetries` times. A 4xx is final and surfaces immediately.
 */
export function retryTransientErrors(maxRetries: number = MAX_QUERY_RETRIES) {
  return (failureCount: number, error: unknown): boolean =>
    failureCount < maxRetries && isTransientRequestError(error);
}

/**
 * TanStack Query client configuration
 */
export const queryClient: QueryClient = new QueryClient({
  mutationCache: new MutationCache({
    // ADR-026-R7: a "To do" closes by itself when its condition is met, and any write can be the one that meets it (a check-in
    // completed, a receipt uploaded, a request answered). So the list and the number on the nav are read again after every
    // successful write, instead of each of the hundred mutations of the app naming them. Only the screens that show them (an
    // active query) ask the server; the others are marked stale and read on their next visit.
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [INTERNAL_ACTIVITIES_KEY] });
    },
  }),
  defaultOptions: {
    queries: {
      // Stale time: data considered fresh for 5 minutes
      staleTime: 5 * 60 * 1000,
      // Cache time: unused data kept in cache for 10 minutes
      gcTime: 10 * 60 * 1000,
      // No retry on 4xx; at most 2 retries (1 s, 2 s) on 5xx and network errors
      retry: retryTransientErrors(),
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      // Refetch on window focus for fresh data
      refetchOnWindowFocus: true,
      // Don't refetch on mount if data is fresh
      refetchOnMount: false,
    },
    mutations: {
      // Writes are not idempotent (bookings, payments): a retry after a lost response could
      // apply them twice, so mutations never retry automatically.
      retry: false,
    },
  },
});
