import { useOrgDestinations, useOrgStays, usePlatformDestinations, usePlatformStays } from '@/queries/use-public-stays';
import type { PublicDestination, PublicStaysQuery, PublicStaysResult } from '@/types/public-stays.types';

export type SearchScope = { kind: 'org'; slug: string; hostName: string } | { kind: 'platform' };

export const PLATFORM_SCOPE: SearchScope = { kind: 'platform' };

export interface ScopedStays {
  data: PublicStaysResult | undefined;
  isPending: boolean;
  isError: boolean;
  isFetching: boolean;
  isPlaceholderData: boolean;
  refetch: () => Promise<unknown>;
  hasNextPage: boolean;
  fetchNextPage: () => Promise<unknown>;
  isFetchingNextPage: boolean;
}

interface ScopedOptions {
  enabled?: boolean;
  keepPrevious?: boolean;
  pageSize?: number;
}

const NO_MORE = () => Promise.resolve();

export function useScopedStays(scope: SearchScope, query: PublicStaysQuery, { enabled = true, keepPrevious = false, pageSize }: ScopedOptions = {}): ScopedStays {
  const org = scope.kind === 'org';
  const site = useOrgStays(org ? scope.slug : undefined, query, { enabled: org && enabled, keepPrevious });
  const platform = usePlatformStays(query, { enabled: !org && enabled, keepPrevious, pageSize });

  if (org) {
    const { data, isPending, isError, isFetching, isPlaceholderData, refetch } = site;
    return { data, isPending, isError, isFetching, isPlaceholderData, refetch, hasNextPage: false, fetchNextPage: NO_MORE, isFetchingNextPage: false };
  }
  return platform;
}

export function useScopedDestinations(scope: SearchScope): readonly PublicDestination[] | undefined {
  const org = scope.kind === 'org';
  const site = useOrgDestinations(org ? scope.slug : undefined);
  const platform = usePlatformDestinations(!org);
  return (org ? site.data : platform.data) ?? undefined;
}
