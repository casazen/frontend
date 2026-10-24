import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { BOOKING_THREAD_QUERY, HOST_THREADS_QUERY, UNREAD_MESSAGES_QUERY } from '@/queries/use-booking-messages';
import { NOTIFICATIONS_QUERY, UNREAD_COUNT_KEY } from '@/queries/use-notifications';
import {
  createRealtimeClient,
  createSignalrFactory,
  type NotificationsChange,
  type RealtimeClient,
  type RealtimeState,
} from './realtime-client';

/** Only a guest message changes a thread: every other `entityId` (booking, service request, property) is not read as a thread. */
const THREAD_TYPE = 'guest-message';

/**
 * What a change makes stale. The count is written as the server sent it (no extra request); the list, the threads of the Home and
 * the per-booking counters are read again; the thread of the booking is read again too, for a guest message only (the entity of other types may be a service request or a property) (an open tab shows the new
 * message at once). A change without an entity (read on another device, unknown type) refreshes every open thread.
 */
export function applyNotificationsChange(queryClient: QueryClient, change: NotificationsChange): void {
  queryClient.setQueryData(UNREAD_COUNT_KEY, change.unreadCount);
  void queryClient.invalidateQueries({ queryKey: [NOTIFICATIONS_QUERY], predicate: (query) => query.queryKey[1] !== UNREAD_COUNT_KEY[1] });
  void queryClient.invalidateQueries({ queryKey: [HOST_THREADS_QUERY] });
  void queryClient.invalidateQueries({ queryKey: [UNREAD_MESSAGES_QUERY] });
  if (change.entityId && change.type === THREAD_TYPE) {
    void queryClient.invalidateQueries({ queryKey: [BOOKING_THREAD_QUERY, change.entityId] });
  } else if (!change.entityId || change.type === null) {
    void queryClient.invalidateQueries({ queryKey: [BOOKING_THREAD_QUERY] });
  }
}

/** After a gap in the channel events may have been missed: everything the channel feeds is read again, the count included. */
export function refreshAfterGap(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: [NOTIFICATIONS_QUERY] });
  void queryClient.invalidateQueries({ queryKey: [HOST_THREADS_QUERY] });
  void queryClient.invalidateQueries({ queryKey: [UNREAD_MESSAGES_QUERY] });
  void queryClient.invalidateQueries({ queryKey: [BOOKING_THREAD_QUERY] });
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
}

/**
 * Keeps the real-time channel of the notifications open while `enabled` and feeds the query cache from it (`applyNotificationsChange`).
 * Returns its state, which the bell uses to poll only while the socket is down.
 */
export function useNotificationsRealtime({ enabled, userId, getAccessToken, client }: Options): RealtimeState {
  const queryClient = useQueryClient();
  const active = enabled && userId !== null;

  useEffect(() => {
    if (!active) return;
    const channel = client ?? acquireShared(getAccessToken);
    let wasConnected = channel.getState() === 'connected';
    let hadGap = false;
    const offChange = channel.onChange((change) => applyNotificationsChange(queryClient, change));
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
