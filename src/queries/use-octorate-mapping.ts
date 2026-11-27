import { useMutation, useQueries, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { octorateApi } from '@/api/octorate.api';
import { propertyIcalApi } from '@/api/property-ical.api';
import { useProperties } from '@/queries/use-properties';
import { propertyIcalFeedsKey } from '@/queries/use-property-ical';
import { ENTITLEMENT_QUERY_KEY } from '@/queries/use-users';
import type { OctorateListing } from '@/types';

export const OCTORATE_LISTINGS_KEY = ['octorate', 'listings'] as const;

const PROPERTIES_KEY = ['properties'] as const;

const SHORT_RENT = { mode: 'short' } as const;

export function useShortRentProperties() {
  return useProperties(SHORT_RENT);
}

/**
 * The listings found on the channel manager with their mapping (E02/F01/US02, `GET api/octorate/properties`): what CasaZen stored, with
 * no call to the channel manager. The listings change on other screens (a mapping confirmed, a property imported), and `queryClient` does
 * not read again on mount, so every visit of a step reads them again; the window gaining the focus does not.
 */
export function useFoundListings(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: OCTORATE_LISTINGS_KEY,
    queryFn: () => octorateApi.getFoundListings(),
    enabled: options?.enabled ?? true,
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
  });
}

export function fetchFoundListings(queryClient: QueryClient): Promise<OctorateListing[]> {
  return queryClient.fetchQuery({ queryKey: OCTORATE_LISTINGS_KEY, queryFn: () => octorateApi.getFoundListings(), staleTime: 0 });
}

function refreshAfterChange(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: OCTORATE_LISTINGS_KEY });
  void queryClient.invalidateQueries({ queryKey: ['bookings'] });
}

export function useRefreshListings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => octorateApi.refreshListings(),
    onSuccess: (listings) => {
      queryClient.setQueryData(OCTORATE_LISTINGS_KEY, listings);
    },
    onSettled: () => refreshAfterChange(queryClient),
  });
}

export function useConfirmMapping() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ listingId, propertyId, roomId }: { listingId: string; propertyId: string; roomId?: string }) =>
      octorateApi.confirmMapping(listingId, propertyId, roomId || undefined),
    onSettled: () => refreshAfterChange(queryClient),
  });
}

export function useSetMappingRoom() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ listingId, roomId }: { listingId: string; roomId: string }) => octorateApi.setMappingRoom(listingId, roomId),
    onSettled: () => refreshAfterChange(queryClient),
  });
}

export function useRejectMapping() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (listingId: string) => octorateApi.rejectMapping(listingId),
    onSettled: () => refreshAfterChange(queryClient),
  });
}

export function useImportListing() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (listingId: string) => octorateApi.importListing(listingId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: PROPERTIES_KEY });
      void queryClient.invalidateQueries({ queryKey: ENTITLEMENT_QUERY_KEY });
    },
    onSettled: () => refreshAfterChange(queryClient),
  });
}

export function useIcalFeedsOfProperties(propertyIds: readonly string[]) {
  return useQueries({
    queries: propertyIds.map((propertyId) => ({
      queryKey: propertyIcalFeedsKey(propertyId),
      queryFn: () => propertyIcalApi.getFeeds(propertyId),
      refetchOnMount: 'always' as const,
      refetchOnWindowFocus: false,
    })),
  });
}
