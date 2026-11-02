import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { COMPLIANCE_KEY } from '@/features/compliance/use-compliance';
import { ALLOGGIATI_KEY } from '@/queries/use-alloggiati';
import { BOOKING_THREAD_QUERY, HOST_THREADS_QUERY, UNREAD_MESSAGES_QUERY } from '@/queries/use-booking-messages';
import { BOOKINGS_KEY } from '@/queries/use-bookings';
import { CHECKIN_SESSION_KEY } from '@/queries/use-checkin';
import { DASHBOARD_KEY } from '@/queries/use-dashboard';
import { NOTIFICATIONS_QUERY, UNREAD_COUNT_KEY } from '@/queries/use-notifications';
import {
  createRealtimeClient,
  createSignalrFactory,
  type NotificationsChange,
  type RealtimeClient,
  type RealtimeState,
} from './realtime-client';

/** Whether a notification type is about a service request (its `entityId` is not a booking). */
export function isServiceRequestType(type: string | null): boolean {
  return type !== null && type.startsWith('service-request');
}

/** The guest of a booking completed the online check-in (`PushTypes.GuestCheckInCompleted`); its `entityId` is the booking. */
const GUEST_CHECKIN_COMPLETED = 'guest-checkin-completed';

/** The guests list and the guest card (`['guests', …]`, not shared as a constant by the pages that read them). */
const GUESTS_QUERY = 'guests';

/**
 * What a completed check-in changes on screen, apart from the bell: the booking and its page, the link of the online check-in (the
 * step "Cosa succede ora" reads it), the guests of the stay and Alloggiati Web, the cockpit and the counter of the menu, the Home,
 * and the guests of the organisation. A page open in front of the host shows it without a reload.
 */
const STALE_ON_CHECK_IN: readonly string[] = [BOOKINGS_KEY, CHECKIN_SESSION_KEY, ALLOGGIATI_KEY, COMPLIANCE_KEY, DASHBOARD_KEY, GUESTS_QUERY];

function refreshCheckInData(queryClient: QueryClient): void {
  STALE_ON_CHECK_IN.forEach((root) => void queryClient.invalidateQueries({ queryKey: [root] }));
}

/**
 * What a change makes stale. The count is written as the server sent it (no extra request); the list, the threads of the Home and
 * the per-booking counters are read again; the thread of the booking in the change is read again too (an open tab shows the new
 * message at once). A change without an entity (read on another device, unknown type) refreshes every open thread. A completed
 * check-in also refreshes the data it changes (`STALE_ON_CHECK_IN`).
 */
export function applyNotificationsChange(queryClient: QueryClient, change: NotificationsChange): void {
  queryClient.setQueryData(UNREAD_COUNT_KEY, change.unreadCount);
  void queryClient.invalidateQueries({ queryKey: [NOTIFICATIONS_QUERY], predicate: (query) => query.queryKey[1] !== UNREAD_COUNT_KEY[1] });
  void queryClient.invalidateQueries({ queryKey: [HOST_THREADS_QUERY] });
  void queryClient.invalidateQueries({ queryKey: [UNREAD_MESSAGES_QUERY] });
  if (change.entityId && !isServiceRequestType(change.type)) {
    void queryClient.invalidateQueries({ queryKey: [BOOKING_THREAD_QUERY, change.entityId] });
  } else if (!change.entityId) {
    void queryClient.invalidateQueries({ queryKey: [BOOKING_THREAD_QUERY] });
  }
  if (change.type === GUEST_CHECKIN_COMPLETED) refreshCheckInData(queryClient);
}

/** After a gap in the channel events may have been missed: everything the channel feeds is read again, the count included. */
export function refreshAfterGap(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: [NOTIFICATIONS_QUERY] });
  void queryClient.invalidateQueries({ queryKey: [HOST_THREADS_QUERY] });
  void queryClient.invalidateQueries({ queryKey: [UNREAD_MESSAGES_QUERY] });
  void queryClient.invalidateQueries({ queryKey: [BOOKING_THREAD_QUERY] });
  // A check-in completed while the channel was down sent no message: the pages that show its data read it again.
  refreshCheckInData(queryClient);
}

// One connection per tab: every user of the hook shares this client, and the channel closes with the last one.
let sharedClient: RealtimeClient | null = null;
let sharedUsers = 0;
let currentTokenGetter: () => Promise<string | undefined> = async () => undefined;

function getShared(): RealtimeClient {
  sharedClient ??= createRealtimeClient(createSignalrFactory(() => currentTokenGetter()));
  return sharedClient;
}

function acquireShared(getAccessToken: () => Promise<string | undefined>): RealtimeClient {
  currentTokenGetter = getAccessToken;
  sharedUsers += 1;
  return getShared();
}

function releaseShared(): void {
  sharedUsers = Math.max(0, sharedUsers - 1);
  if (sharedUsers === 0) sharedClient?.disconnect();
}

interface Options {
  /** False for a guest, a public page, the demo or a signed-out user: no channel is opened. */
  enabled: boolean;
  /** The channel is bound to a user: another user (or none) closes it and opens a new one. */
  userId: string | null;
  getAccessToken: () => Promise<string | undefined>;
  /** For tests: a client other than the shared SignalR one (it is then connected and disconnected by this hook alone). */
  client?: RealtimeClient;
  /**
   * Called when a NEW notification arrives (the bell shows a pop-up from it), after the cache is updated. Not for a notification
   * that was read: the server also sends the type and the booking when the host reads a guest thread, but then the count falls.
   * The latest function is the one called, a new one does not reopen the channel.
   */
  onNewNotification?: (change: NotificationsChange) => void;
}

/**
 * Keeps the real-time channel of the notifications open while `enabled` and feeds the query cache from it (`applyNotificationsChange`).
 * Returns its state, which the bell uses to poll only while the socket is down.
 */
export function useNotificationsRealtime({ enabled, userId, getAccessToken, client, onNewNotification }: Options): RealtimeState {
  const queryClient = useQueryClient();
  const active = enabled && userId !== null;
  const onNewRef = useRef(onNewNotification);
  useEffect(() => {
    onNewRef.current = onNewNotification;
  });

  useEffect(() => {
    if (!active) return;
    const channel = client ?? acquireShared(getAccessToken);
    let wasConnected = channel.getState() === 'connected';
    let hadGap = false;
    const offChange = channel.onChange((change) => {
      const before = queryClient.getQueryData<number>(UNREAD_COUNT_KEY);
      applyNotificationsChange(queryClient, change);
      // A new notification makes the count grow; reading one makes it fall. Without a count to compare with (still loading) it
      // cannot be told, and a missing pop-up costs less than a wrong one: the badge shows the count either way.
      if (change.type !== null && typeof before === 'number' && change.unreadCount > before) onNewRef.current?.(change);
    });
    const offState = channel.onState((state) => {
      if (state === 'connected') {
        // Events sent while it was down are lost: a reconnect (not the first connection) reads everything again.
        if (hadGap) refreshAfterGap(queryClient);
        hadGap = false;
        wasConnected = true;
      } else if (wasConnected) {
        hadGap = true;
      }
    });
    channel.connect();
    return () => {
      offChange();
      offState();
      if (client) client.disconnect();
      else releaseShared();
    };
    // `getAccessToken` is read when a connection opens, through `currentTokenGetter`: a new function must not reopen the channel.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, userId, client, queryClient]);

  const target = client ?? getShared();
  const subscribe = useCallback((listener: () => void) => target.onState(listener), [target]);
  return useSyncExternalStore(subscribe, () => target.getState(), () => 'disconnected');
}
