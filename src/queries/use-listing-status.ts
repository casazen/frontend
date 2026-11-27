import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { listingStatusApi } from '@/api/listing-status.api';
import { propertiesApi } from '@/api/properties.api';
import { siteProfileApi } from '@/api/site-profile.api';
import type { ListingPublishRequest, OutsideChangeChoice, Property, SiteProfile } from '@/types';

const PROPERTIES_KEY = 'properties';

export const listingStatusKey = (propertyId: string | undefined) => [PROPERTIES_KEY, propertyId, 'channel-status'] as const;

/** The summary of every property for the list: outside the key of one property, so a status read never refreshes it by mistake. */
export const LISTING_SUMMARY_KEY = ['listing-status-summary'] as const;

/** How often the status is read again while a channel is still `Sending` (E02/F03/US01/T04): the wizard shows each result as it arrives. */
const SENDING_POLL_MS = 5_000;

/**
 * The state of the listing of a property on each channel. It is read again every 5 seconds while a row is `Sending`, and every time the
 * wizard or the sheet is shown (the state moves on the server by itself, with the jobs of the channel manager). `enabled` is false while the
 * connector is off: the endpoints answer 404 then.
 */
export function useListingStatus(propertyId: string | undefined, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: listingStatusKey(propertyId),
    queryFn: () => listingStatusApi.getStatus(propertyId!),
    enabled: Boolean(propertyId) && (options.enabled ?? true),
    refetchOnMount: 'always',
    refetchInterval: (query) => (query.state.data?.channels.some((channel) => channel.status === 'Sending') ? SENDING_POLL_MS : false),
  });
}

/** The worst state of each property that has a channel, for the list of the properties. Nothing is asked while the connector is off. */
export function useListingStatusSummary(enabled: boolean) {
  return useQuery({
    queryKey: LISTING_SUMMARY_KEY,
    queryFn: () => listingStatusApi.getSummary(),
    enabled,
    refetchOnMount: 'always',
  });
}

/** Every mutation of the listing reads the status again: a publication or a choice about a change moves it, and so does the summary. */
function invalidateStatus(queryClient: QueryClient, propertyId: string) {
  void queryClient.invalidateQueries({ queryKey: listingStatusKey(propertyId) });
  void queryClient.invalidateQueries({ queryKey: LISTING_SUMMARY_KEY });
}

/**
 * Publishes the property to the channels asked for. Silent: the channels step tells how each channel went (and what to fix) where the
 * person is looking. The status is read again whatever the answer: a refused publication can still have changed a row.
 */
export function usePublishListing(propertyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: ListingPublishRequest) => listingStatusApi.publish(propertyId, request),
    onSettled: () => invalidateStatus(queryClient, propertyId),
  });
}

/** What the server holds of the texts after «Prendi la nuova versione» rewrote them: the property and its site profile, read again right after. */
export interface AdoptedTexts {
  property: Property;
  siteProfile: SiteProfile;
}

/**
 * How a choice about a change made outside CasaZen ended. For «take» the texts the channel manager held are on the server now and the
 * form of the wizard still has the old ones: `adopted` carries what the server has, for the wizard to start its form from again (or its next
 * save would send the old texts back over them). `rereadFailed` is a «take» that went through whose texts could not be read again.
 */
export interface OutsideChangeResult {
  adopted: AdoptedTexts | null;
  rereadFailed: boolean;
}

/** The choice about a change made outside CasaZen: keep CasaZen's version, or take the descriptions of the channel manager. */
export function useResolveOutsideChange(propertyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ channelCode, choice }: { channelCode: string; choice: OutsideChangeChoice }): Promise<OutsideChangeResult> => {
      await listingStatusApi.resolveOutsideChange(propertyId, channelCode, choice);
      if (choice !== 'take') return { adopted: null, rereadFailed: false };
      // The choice is made: a failure to read the texts again is told to the person (the form must not go on with the old ones), not hidden.
      try {
        const [property, siteProfile] = await Promise.all([propertiesApi.getById(propertyId), siteProfileApi.get(propertyId)]);
        return { adopted: { property, siteProfile }, rereadFailed: false };
      } catch {
        return { adopted: null, rereadFailed: true };
      }
    },
    onSettled: () => {
      invalidateStatus(queryClient, propertyId);
      // «Prendi la nuova versione» writes the descriptions of the property: everything that reads it is read again.
      void queryClient.invalidateQueries({ queryKey: [PROPERTIES_KEY, propertyId] });
    },
  });
}
