import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { propertyIcalApi } from '@/api/property-ical.api';
import i18n from '@/i18n/config';
import { getHttpStatus, getProblemMessage } from '@/lib/api-errors';
import type { CalendarOverview, PropertyIcalFeed, PropertyIcalFeedCreateRequest } from '@/types/property-ical';

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

/** Next poll of a query while something it lists is syncing: none when nothing is, otherwise fast first and then slower. */
function pollWhileSyncing(query: object, syncing: boolean, now: number): number | false {
  if (!syncing) {
    syncingSince.delete(query);
    return false;
  }
  const since = syncingSince.get(query) ?? now;
  syncingSince.set(query, since);
  return now - since < SYNCING_FAST_WINDOW_MS ? SYNCING_FAST_REFETCH_MS : SYNCING_SLOW_REFETCH_MS;
}

/** Next poll of the feeds list: none when no feed is syncing, otherwise fast first and then slower. */
export function syncingRefetchInterval(
  query: { state: { data?: PropertyIcalFeed[] } },
  now: number = Date.now(),
): number | false {
  return pollWhileSyncing(query, query.state.data?.some(isSyncing) ?? false, now);
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

export const calendarOverviewKey = ['property-calendar-overview'] as const;

const isOverviewSyncing = (overview: CalendarOverview | undefined) =>
  overview?.properties.some((property) => property.feeds.some((feed) => feed.syncing)) ?? false;

/** True when a feed of the overview that was syncing has finished (successfully or not): its blocks may have changed. */
function overviewSyncEnded(previous: CalendarOverview | undefined, next: CalendarOverview): boolean {
  const before = new Set(
    (previous?.properties ?? []).flatMap((property) => property.feeds.filter((feed) => feed.syncing).map((feed) => feed.feedId)),
  );
  return next.properties.some((property) => property.feeds.some((feed) => !feed.syncing && before.has(feed.feedId)));
}

/**
 * The calendars of every property in one read (SR-10b), for the page "Canali e calendari". It is read again at every visit (the page
 * is where one comes to see whether a calendar answers) and polled while any feed syncs: one cycle for the whole page, never one per
 * row. When a sync ends the booking calendars are refreshed with the new blocks, as for the feeds of one property.
 */
export function useCalendarOverview() {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: calendarOverviewKey,
    queryFn: async () => {
      const previous = queryClient.getQueryData<CalendarOverview>(calendarOverviewKey);
      const overview = await propertyIcalApi.getCalendarOverview();
      if (overviewSyncEnded(previous, overview)) void queryClient.invalidateQueries({ queryKey: BOOKING_CALENDAR_KEY });
      return overview;
    },
    refetchOnMount: 'always',
    refetchInterval: (query) => pollWhileSyncing(query, isOverviewSyncing(query.state.data), Date.now()),
  });
}

function markFeedSyncing(overview: CalendarOverview, feedId: string): CalendarOverview {
  return {
    ...overview,
    properties: overview.properties.map((property) => ({
      ...property,
      feeds: property.feeds.map((feed) =>
        feed.feedId === feedId ? { ...feed, syncing: true, lastImportStatus: 'Syncing' as const } : feed,
      ),
    })),
  };
}

/**
 * "Sync now" of one feed from the overview: the answer puts the row in "Syncing" at once, which starts the polling of the page, and
 * replaces the feed in the list of the property's own tab, if that was read (as the sync of that tab does). Errors: toast here (the
 * row stays as it was).
 */
export function useSyncCalendarFeed() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ propertyId, feedId }: { propertyId: string; feedId: string }) => propertyIcalApi.syncFeed(propertyId, feedId),
    onSuccess: (feed, { propertyId, feedId }) => {
      queryClient.setQueryData<CalendarOverview>(calendarOverviewKey, (overview) => overview && markFeedSyncing(overview, feedId));
      queryClient.setQueryData<PropertyIcalFeed[]>(propertyIcalFeedsKey(propertyId), (feeds) =>
        feeds?.map((current) => (current.id === feed.id ? { ...current, ...feed } : current)),
      );
      toast.success(i18n.t('ical.syncStarted'));
    },
    onError: (error) => {
      // 404 `ical_feed_not_found`: the feed was removed meanwhile (another tab, another user): show the page as it is now.
      if (getHttpStatus(error) === 404) void queryClient.invalidateQueries({ queryKey: calendarOverviewKey });
      toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('ical.feedSyncFailed'));
    },
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
