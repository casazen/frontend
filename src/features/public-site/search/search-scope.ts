import { useOrgDestinations, useOrgStays, usePlatformDestinations, usePlatformStays } from '@/queries/use-public-stays';
import type { PublicDestination, PublicStaysQuery, PublicStaysResult } from '@/types/public-stays.types';

/**
 * What the results page searches in: the homes of ONE booking site (`/book/:orgSlug/search`, DB-07c) or the homes of ALL of them (the
 * public `/search` of CasaZen). It is the same page, the same bar, sheet, chips, cards and map; the scope decides where the data
 * come from, whose theme the page wears (the host's, or CasaZen's: that is the shell's) and which parts make sense (the hearts and the
 * line to the host belong to a site; the host of each home is on its card in the search across all of them).
 */
export type SearchScope = { kind: 'org'; slug: string; hostName: string } | { kind: 'platform' };

export const PLATFORM_SCOPE: SearchScope = { kind: 'platform' };

/** The answer of the search of a scope, in the one shape the page reads. A site has no more pages: its list is whole. */
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
  /** Keep showing the previous answer while the next one is on its way. */
  keepPrevious?: boolean;
  /** Homes per page in the search across all the sites; 1 only counts. */
  pageSize?: number;
}

const NO_MORE = () => Promise.resolve();

/** The homes of the scope for a stay and some filters. Both searches are asked as hooks must be; only the one of the scope is enabled. */
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

/** The places of the scope for the «Dove» field. */
export function useScopedDestinations(scope: SearchScope): readonly PublicDestination[] | undefined {
  const org = scope.kind === 'org';
  const site = useOrgDestinations(org ? scope.slug : undefined);
  const platform = usePlatformDestinations(!org);
  return (org ? site.data : platform.data) ?? undefined;
}
