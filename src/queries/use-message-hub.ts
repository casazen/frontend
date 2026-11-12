import { useEffect } from 'react';
import { keepPreviousData, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { messageHubApi } from '@/api/message-hub.api';
import { retryTransientErrors } from '@/lib/query-client';
import { NOTIFICATIONS_QUERY } from '@/queries/use-notifications';
import type { MessageHubFilters, MessageHubUnread } from '@/types';

/** Root of the queries of the hub of messages: the list, the counters and the conversations that are open. */
export const MESSAGE_HUB_QUERY = 'message-hub';

/** How often the hub is read again while the page is visible: it has no real-time channel of its own in v1. */
export const MESSAGE_HUB_POLL_MS = 60_000;

/**
 * The list of the conversations and the counters of the hub: what an answer or a read changes, wherever it is given (the page of a
 * conversation, the tab of a booking, the drawer of a booking). They are marked stale and, where a page shows them (the Home, the inbox,
 * the number on the tab «Messaggi»), read again at once.
 */
export function invalidateMessageHubLists(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: [MESSAGE_HUB_QUERY, 'threads'] });
  void queryClient.invalidateQueries({ queryKey: [MESSAGE_HUB_QUERY, 'unread'] });
}

/**
 * A guest's message makes the in-app notifications change (the number on the bell, the pop-up), whether the real-time channel writes the
 * count or the list is read again. When any of those queries is written, the hub is stale too: it is read again at once, instead of
 * at the next minute. Called with `cancelRefetch: false`, so that two hooks of the hub on one page do not restart each other's reading.
 */
export function useRefetchOnNotificationsChange(enabled: boolean): void {
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!enabled) return;
    return queryClient.getQueryCache().subscribe((event) => {
      if (event.type === 'updated' && event.action.type === 'success' && event.query.queryKey[0] === NOTIFICATIONS_QUERY) {
        void queryClient.invalidateQueries({ queryKey: [MESSAGE_HUB_QUERY] }, { cancelRefetch: false });
      }
    });
  }, [enabled, queryClient]);
}

/**
 * The conversations of the host, the channels' and the direct ones in one list (`GET /api/messages?includeOta=true`, NF-61). Other
 * screens change what is in it (an answer given from a booking, a thread read), so it is read again on every visit, again every minute
 * while the page is visible, on return to the window, and when the in-app notifications change. The rows of the page that was shown stay
 * while the next one comes (`keepPreviousData`).
 */
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

/**
 * The conversations with messages of the guest not read yet, counters only (`GET /api/messages/unread?includeOta=true`): what gives the
 * entry of the menu its number. Kept fresh the same way as the list.
 */
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
 * How many messages of the guests wait to be read, in all the conversations: the sum of the counters. `undefined` when the answer is
 * not the shape of the API (a page served instead of it): a counter is a hint and never an error.
 */
export function totalUnread(unread: MessageHubUnread | undefined): number | undefined {
  const items = unread?.items;
  if (!Array.isArray(items)) return undefined;
  return items.reduce((sum, item) => sum + (Number.isFinite(item.unreadCount) && item.unreadCount > 0 ? Math.floor(item.unreadCount) : 0), 0);
}
