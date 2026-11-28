import { useEffect } from 'react';
import { keepPreviousData, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { messageHubApi } from '@/api/message-hub.api';
import { retryTransientErrors } from '@/lib/query-client';
import { NOTIFICATIONS_QUERY } from '@/queries/use-notifications';
import type { MessageHubFilters, MessageHubUnread } from '@/types';

export const MESSAGE_HUB_QUERY = 'message-hub';

export const MESSAGE_HUB_POLL_MS = 60_000;

export function invalidateMessageHubLists(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: [MESSAGE_HUB_QUERY, 'threads'] });
  void queryClient.invalidateQueries({ queryKey: [MESSAGE_HUB_QUERY, 'unread'] });
}

const LIVE_PARTS: readonly string[] = ['threads', 'unread', 'thread', 'review-thread', 'channel-status'];

/**
 * A guest's message makes the in-app notifications change (the number on the bell, the pop-up), whether the real-time channel writes the
 * count or the list is read again (the window coming back to the front does it too). When any of those queries is written, the live parts
 * of the hub ({@link LIVE_PARTS}) are stale too: they are read again at once, instead of at the next minute. Called with
 * `cancelRefetch: false`, so that two hooks of the hub on one page do not restart each other's reading.
 */
export function useRefetchOnNotificationsChange(enabled: boolean): void {
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!enabled) return;
    return queryClient.getQueryCache().subscribe((event) => {
      if (event.type === 'updated' && event.action.type === 'success' && event.query.queryKey[0] === NOTIFICATIONS_QUERY) {
        void queryClient.invalidateQueries(
          { queryKey: [MESSAGE_HUB_QUERY], predicate: (query) => LIVE_PARTS.includes(String(query.queryKey[1])) },
          { cancelRefetch: false },
        );
      }
    });
  }, [enabled, queryClient]);
}

export function useMessageHubThreads(filters: MessageHubFilters, enabled: boolean = true) {
  useRefetchOnNotificationsChange(enabled);
  return useQuery({
    queryKey: [MESSAGE_HUB_QUERY, 'threads', filters],
    queryFn: () => messageHubApi.list(filters),
    enabled,
    refetchOnMount: 'always',
    refetchInterval: MESSAGE_HUB_POLL_MS,
    refetchOnWindowFocus: true,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
    retry: retryTransientErrors(1),
  });
}

export function useMessageHubUnread(enabled: boolean = true) {
  useRefetchOnNotificationsChange(enabled);
  return useQuery({
    queryKey: [MESSAGE_HUB_QUERY, 'unread'],
    queryFn: () => messageHubApi.unread(),
    enabled,
    refetchInterval: MESSAGE_HUB_POLL_MS,
    refetchOnWindowFocus: true,
    staleTime: 30_000,
    retry: retryTransientErrors(1),
  });
}

/**
 * Whether the chat of each listing works (`GET /api/messages/channel-status`, E23/F01/US02): the inbox tells with it which listings have no chat yet instead of
 * showing an empty list. The server moves it at each pass of the copy of the conversations, so it is read again on every visit, every minute while the page is
 * visible, on return to the window and when the in-app notifications change. `enabled` is false while there is no connection to the channels: nothing is asked then.
 */
export function useMessageChannelStatus(enabled: boolean = true) {
  useRefetchOnNotificationsChange(enabled);
  return useQuery({
    queryKey: [MESSAGE_HUB_QUERY, 'channel-status'],
    queryFn: () => messageHubApi.getChannelStatus(),
    enabled,
    refetchOnMount: 'always',
    refetchInterval: MESSAGE_HUB_POLL_MS,
    refetchOnWindowFocus: true,
    staleTime: 30_000,
    retry: retryTransientErrors(1),
  });
}

/**
 * How many messages of the guests wait to be read, in all the conversations: the sum of the counters. `undefined` when the answer is
 * not the shape of the API (a page served instead of it): a counter is a hint and never an error.
 */
export function totalUnread(unread: MessageHubUnread | undefined): number | undefined {
  const items = unread?.items;
  if (!Array.isArray(items)) return undefined;
  return items.reduce((sum, item) => sum + (Number.isFinite(item.unreadCount) && item.unreadCount > 0 ? Math.floor(item.unreadCount) : 0), 0);
}
