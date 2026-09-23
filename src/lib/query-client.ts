import { QueryClient } from '@tanstack/react-query';
import { isTransientRequestError } from '@/lib/api-errors';

/** Retries after the first failure for queries: 2 (so at most 3 attempts). */
export const MAX_QUERY_RETRIES = 2;

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
export const queryClient = new QueryClient({
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
