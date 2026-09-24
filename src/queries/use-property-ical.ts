import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { propertyIcalApi } from '@/api/property-ical.api';
import i18n from '@/i18n/config';
import { getProblemMessage } from '@/lib/api-errors';
import type { PropertyIcalFeed, PropertyIcalFeedCreateRequest } from '@/types/property-ical';

/** While a feed is syncing (its job is queued), its state is read again every few seconds. */
const SYNCING_REFETCH_MS = 5_000;

export const propertyIcalFeedsKey = (propertyId: string | undefined) => ['property-ical-feeds', propertyId] as const;

/** Import feeds of a property (PC-11: Airbnb, Booking.com, ... each with its own sync state). */
export function usePropertyIcalFeeds(propertyId: string | undefined) {
  return useQuery({
    queryKey: propertyIcalFeedsKey(propertyId),
    queryFn: () => propertyIcalApi.getFeeds(propertyId!),
    enabled: Boolean(propertyId),
    refetchInterval: (query) =>
      query.state.data?.some((feed: PropertyIcalFeed) => feed.lastImportStatus === 'Syncing') ? SYNCING_REFETCH_MS : false,
  });
}

// Feeds, the property's iCal status and the calendar (blocks come and go with the feeds).
function invalidateIcal(queryClient: QueryClient, propertyId: string) {
  void queryClient.invalidateQueries({ queryKey: propertyIcalFeedsKey(propertyId) });
  void queryClient.invalidateQueries({ queryKey: ['property-ical', propertyId] });
  void queryClient.invalidateQueries({ queryKey: ['bookings'] });
}

export function useAddPropertyIcalFeed(propertyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: PropertyIcalFeedCreateRequest) => propertyIcalApi.addFeed(propertyId, data),
    onSuccess: () => {
      invalidateIcal(queryClient, propertyId);
      toast.success(i18n.t('ical.feedAdded'));
    },
    onError: (error) => {
      toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('ical.feedAddFailed'));
    },
  });
}

export function useRemovePropertyIcalFeed(propertyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (feedId: string) => propertyIcalApi.removeFeed(propertyId, feedId),
    onSuccess: () => {
      invalidateIcal(queryClient, propertyId);
      toast.success(i18n.t('ical.feedRemoved'));
    },
    onError: (error) => {
      toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('ical.feedRemoveFailed'));
    },
  });
}

export function useSyncPropertyIcalFeed(propertyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (feedId: string) => propertyIcalApi.syncFeed(propertyId, feedId),
    onSuccess: () => {
      invalidateIcal(queryClient, propertyId);
    },
    onError: (error) => {
      toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('ical.feedSyncFailed'));
    },
  });
}

export function usePropertyIcalExportUrl(propertyId: string | undefined) {
  return useQuery({
    queryKey: ['property-ical-export', propertyId],
    queryFn: () => propertyIcalApi.getExportUrl(propertyId!),
    enabled: Boolean(propertyId),
  });
}
