import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { listingStatusApi } from '@/api/listing-status.api';
import { propertiesApi } from '@/api/properties.api';
import { siteProfileApi } from '@/api/site-profile.api';
import type { ListingPublishRequest, OutsideChangeChoice, Property, SiteProfile } from '@/types';

const PROPERTIES_KEY = 'properties';

export const listingStatusKey = (propertyId: string | undefined) => [PROPERTIES_KEY, propertyId, 'channel-status'] as const;

export const LISTING_SUMMARY_KEY = ['listing-status-summary'] as const;

const SENDING_POLL_MS = 5_000;

export function useListingStatus(propertyId: string | undefined, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: listingStatusKey(propertyId),
    queryFn: () => listingStatusApi.getStatus(propertyId!),
    enabled: Boolean(propertyId) && (options.enabled ?? true),
    refetchOnMount: 'always',
    refetchInterval: (query) => (query.state.data?.channels.some((channel) => channel.status === 'Sending') ? SENDING_POLL_MS : false),
  });
}

export function useListingStatusSummary(enabled: boolean) {
  return useQuery({
    queryKey: LISTING_SUMMARY_KEY,
    queryFn: () => listingStatusApi.getSummary(),
    enabled,
    refetchOnMount: 'always',
  });
}

function invalidateStatus(queryClient: QueryClient, propertyId: string) {
  void queryClient.invalidateQueries({ queryKey: listingStatusKey(propertyId) });
  void queryClient.invalidateQueries({ queryKey: LISTING_SUMMARY_KEY });
}

export function usePublishListing(propertyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: ListingPublishRequest) => listingStatusApi.publish(propertyId, request),
    onSettled: () => invalidateStatus(queryClient, propertyId),
  });
}

export interface AdoptedTexts {
  property: Property;
  siteProfile: SiteProfile;
}

interface OutsideChangeResult {
  adopted: AdoptedTexts | null;
  rereadFailed: boolean;
}

export function useResolveOutsideChange(propertyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ channelCode, choice }: { channelCode: string; choice: OutsideChangeChoice }): Promise<OutsideChangeResult> => {
      await listingStatusApi.resolveOutsideChange(propertyId, channelCode, choice);
      if (choice !== 'take') return { adopted: null, rereadFailed: false };
      try {
        const [property, siteProfile] = await Promise.all([propertiesApi.getById(propertyId), siteProfileApi.get(propertyId)]);
        return { adopted: { property, siteProfile }, rereadFailed: false };
      } catch {
        return { adopted: null, rereadFailed: true };
      }
    },
    onSettled: () => {
      invalidateStatus(queryClient, propertyId);
      void queryClient.invalidateQueries({ queryKey: [PROPERTIES_KEY, propertyId] });
    },
  });
}
