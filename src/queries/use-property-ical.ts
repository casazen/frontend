import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { propertyIcalApi } from '@/api/property-ical.api';
import i18n from '@/i18n/config';
import { getHttpStatus, getProblemMessage } from '@/lib/api-errors';
import type { PropertyIcalFeed, PropertyIcalFeedCreateRequest } from '@/types/property-ical';

/**
 * Light polling while a feed is syncing (its job is queued): every few seconds during the first minute, when the
 * download usually ends, then slower until the 15-minute job settles it.
 */
const SYNCING_FAST_REFETCH_MS = 3_000;
const SYNCING_SLOW_REFETCH_MS = 15_000;
const SYNCING_FAST_WINDOW_MS = 60_000;

/** Calendar views of the bookings (`useBookingCalendar`): the imported blocks come and go with the feeds. */
const BOOKING_CALENDAR_KEY = ['bookings', 'calendar'] as const;

export const propertyIcalFeedsKey = (propertyId: string | undefined) => ['property-ical-feeds', propertyId] as const;
export const propertyIcalExportKey = (propertyId: string | undefined) => ['property-ical-export', propertyId] as const;

const isSyncing = (feed: PropertyIcalFeed) => feed.lastImportStatus === 'Syncing';

// When each feeds query started to see a feed in `Syncing` (keyed by the query object, dropped with it).
const syncingSince = new WeakMap<object, number>();

/** Next poll of the feeds list: none when no feed is syncing, otherwise fast first and then slower. */
export function syncingRefetchInterval(
  query: { state: { data?: PropertyIcalFeed[] } },
  now: number = Date.now(),
): number | false {
  if (!query.state.data?.some(isSyncing)) {
    syncingSince.delete(query);
    return false;
  }
  const since = syncingSince.get(query) ?? now;
  syncingSince.set(query, since);
  return now - since < SYNCING_FAST_WINDOW_MS ? SYNCING_FAST_REFETCH_MS : SYNCING_SLOW_REFETCH_MS;
}

/** True when a feed that was syncing has finished (successfully or not): its blocks may have changed. */
function syncEnded(previous: PropertyIcalFeed[] | undefined, next: PropertyIcalFeed[]): boolean {
  return (previous ?? []).some(
    (before) => isSyncing(before) && next.some((after) => after.id === before.id && !isSyncing(after)),
  );
}

/**
 * Import feeds of a property (PC-11: Airbnb, Booking.com, ... each with its own sync state). Polled while a feed is
 * `Syncing`; when a sync ends the booking calendars are refreshed with the new blocks (PC-13).
 */
export function usePropertyIcalFeeds(propertyId: string | undefined) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: propertyIcalFeedsKey(propertyId),
    queryFn: async () => {
      const previous = queryClient.getQueryData<PropertyIcalFeed[]>(propertyIcalFeedsKey(propertyId));
      const feeds = await propertyIcalApi.getFeeds(propertyId!);
      if (syncEnded(previous, feeds)) void queryClient.invalidateQueries({ queryKey: BOOKING_CALENDAR_KEY });
      return feeds;
    },
    enabled: Boolean(propertyId),
    refetchInterval: syncingRefetchInterval,
  });
}

// Feeds, the property's iCal status and the calendar (blocks come and go with the feeds).
function invalidateIcal(queryClient: QueryClient, propertyId: string) {
  void queryClient.invalidateQueries({ queryKey: propertyIcalFeedsKey(propertyId) });
  void queryClient.invalidateQueries({ queryKey: ['property-ical', propertyId] });
  void queryClient.invalidateQueries({ queryKey: ['bookings'] });
}

// 404 `ical_feed_not_found`: the feed was already removed (another tab, another user): show the list as it is now.
function refreshFeedsWhenGone(queryClient: QueryClient, propertyId: string, error: unknown) {
  if (getHttpStatus(error) === 404) void queryClient.invalidateQueries({ queryKey: propertyIcalFeedsKey(propertyId) });
}

/** Links a calendar. Errors: toast here, inline message in the form (`error` of the mutation, PC-13). */
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

/** Disconnects a calendar: its blocks are deleted with it. Errors: toast here, inline in the confirmation dialog. */
export function useRemovePropertyIcalFeed(propertyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (feedId: string) => propertyIcalApi.removeFeed(propertyId, feedId),
    onSuccess: () => {
      invalidateIcal(queryClient, propertyId);
      toast.success(i18n.t('ical.feedRemoved'));
    },
    onError: (error) => {
      refreshFeedsWhenGone(queryClient, propertyId, error);
      toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('ical.feedRemoveFailed'));
    },
  });
}

/**
 * "Sync now" of one feed: the answer (the feed in `Syncing`) replaces it in the list at once, which starts the
 * polling; the calendar is refreshed when the sync ends. Errors: toast here, inline in the feed row.
 */
export function useSyncPropertyIcalFeed(propertyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (feedId: string) => propertyIcalApi.syncFeed(propertyId, feedId),
    onSuccess: (feed) => {
      queryClient.setQueryData<PropertyIcalFeed[]>(propertyIcalFeedsKey(propertyId), (feeds) =>
        feeds?.map((current) => (current.id === feed.id ? { ...current, ...feed } : current)),
      );
      toast.success(i18n.t('ical.syncStarted'));
    },
    onError: (error) => {
      refreshFeedsWhenGone(queryClient, propertyId, error);
      toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('ical.feedSyncFailed'));
    },
  });
}

export function usePropertyIcalExportUrl(propertyId: string | undefined) {
  return useQuery({
    queryKey: propertyIcalExportKey(propertyId),
    queryFn: () => propertyIcalApi.getExportUrl(propertyId!),
    enabled: Boolean(propertyId),
  });
}

/**
 * New export link (PC-12): the old one stops working, so the host pastes the new one on every OTA. Errors: toast
 * here, inline in the confirmation dialog.
 */
export function useRegeneratePropertyIcalExportUrl(propertyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => propertyIcalApi.regenerateExportUrl(propertyId),
    onSuccess: (data) => {
      queryClient.setQueryData(propertyIcalExportKey(propertyId), data);
      void queryClient.invalidateQueries({ queryKey: ['property-ical', propertyId] });
      toast.success(i18n.t('ical.regenerated'));
    },
    onError: (error) => {
      toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('ical.regenerateFailed'));
    },
  });
}
