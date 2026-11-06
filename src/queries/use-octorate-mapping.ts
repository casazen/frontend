import { useMutation, useQueries, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { octorateApi } from '@/api/octorate.api';
import { propertyIcalApi } from '@/api/property-ical.api';
import { useProperties } from '@/queries/use-properties';
import { propertyIcalFeedsKey } from '@/queries/use-property-ical';
import { ENTITLEMENT_QUERY_KEY } from '@/queries/use-users';
import type { OctorateListing } from '@/types';

export const OCTORATE_LISTINGS_KEY = ['octorate', 'listings'] as const;

/** The properties of the org (the list, the plan usage, the details): an import creates one. */
const PROPERTIES_KEY = ['properties'] as const;

/** The properties a channel manager listing can be: the short-rent ones (a long-rent property is never on a channel manager). */
const SHORT_RENT = { mode: 'short' } as const;

/** The host's short-rent properties, the ones the caller reaches: what a listing is confirmed to, and what the summary names. */
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

/**
 * The listings as the server has them right now, whatever the cache holds: the wizard builds what it is about to do from these, so a
 * listing confirmed meanwhile (another tab, another person) is not confirmed twice.
 */
export function fetchFoundListings(queryClient: QueryClient): Promise<OctorateListing[]> {
  return queryClient.fetchQuery({ queryKey: OCTORATE_LISTINGS_KEY, queryFn: () => octorateApi.getFoundListings(), staleTime: 0 });
}

/** What every change of a mapping leaves behind: the listings are read again (also after a refusal: the server may have moved on). */
function refreshAfterChange(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: OCTORATE_LISTINGS_KEY });
}

/**
 * Reads the listings on the channel manager again and proposes a property for each (`POST api/octorate/properties/refresh`); the answer
 * is the list after the read. Errors are not toasted: the step that asks says what went wrong where the host is looking.
 */
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

/**
 * Confirms a listing to a property (`PUT api/octorate/mapping/{id}`), with the room for a listing that has several. A refusal (409 for a
 * property already confirmed to another listing, 404, 422 for a room that is not the listing's) is the caller's to show, row by row.
 */
export function useConfirmMapping() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ listingId, propertyId, roomId }: { listingId: string; propertyId: string; roomId?: string }) =>
      octorateApi.confirmMapping(listingId, propertyId, roomId || undefined),
    onSettled: () => refreshAfterChange(queryClient),
  });
}

/** Chooses the room of a listing that is already confirmed (`PUT api/octorate/mapping/{id}/room`). */
export function useSetMappingRoom() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ listingId, roomId }: { listingId: string; roomId: string }) => octorateApi.setMappingRoom(listingId, roomId),
    onSettled: () => refreshAfterChange(queryClient),
  });
}

/** Says a listing is not one of the org's properties (`DELETE api/octorate/mapping/{id}`). */
export function useRejectMapping() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (listingId: string) => octorateApi.rejectMapping(listingId),
    onSettled: () => refreshAfterChange(queryClient),
  });
}

/**
 * Imports a listing as a new CasaZen property (`POST api/octorate/mapping/{id}/import`): the list of properties and the plan usage
 * change with it. Nothing is created on the channel manager.
 */
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

/**
 * The iCal feeds of several properties, one read each (`GET api/properties/{id}/ical/feeds`, the cache of the property's own tab): the
 * result of the wizard tells, per confirmed property, what becomes of the calendars the host already has on each channel. The results
 * come in the order of `propertyIds`; one that failed (no access, gone) has no data, and the caller treats it as a property with no feeds.
 */
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
