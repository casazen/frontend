import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { NOTIFICATIONS_PAGE_SIZE, notificationsApi, type NotificationPage } from '@/api/notifications.api';
import { retryTransientErrors } from '@/lib/query-client';

/** Root of every notification query: invalidating it reads the list and the count again. */
export const NOTIFICATIONS_QUERY = 'notifications';
export const UNREAD_COUNT_KEY = [NOTIFICATIONS_QUERY, 'unread-count'] as const;
const LIST_KEY = [NOTIFICATIONS_QUERY, 'list'] as const;

/** Safety net while the real-time channel is down: the count is read again at this pace (and on focus and reconnect). */
export const DISCONNECTED_POLL_MS = 60_000;

/**
 * The number on the bell. The real-time channel writes it directly (`notificationsChanged`); the window focus and the network
 * coming back read it again, and `pollWhileDisconnected` adds a slow poll for as long as the socket is down.
 */
export function useUnreadNotificationCount({ enabled = true, pollWhileDisconnected = false }: { enabled?: boolean; pollWhileDisconnected?: boolean } = {}) {
  return useQuery({
    queryKey: UNREAD_COUNT_KEY,
    queryFn: async () => (await notificationsApi.unreadCount()).count,
    enabled,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchInterval: pollWhileDisconnected ? DISCONNECTED_POLL_MS : false,
    retry: retryTransientErrors(1),
    select: (count) => (Number.isFinite(count) && count > 0 ? Math.floor(count) : 0),
  });
}

/** The notifications of the bell, the most recent first, a page at a time. Read only while the list is open. */
export function useNotificationList(enabled: boolean) {
  return useInfiniteQuery({
    queryKey: LIST_KEY,
    initialPageParam: 1,
    queryFn: ({ pageParam }) => notificationsApi.list({ page: pageParam, pageSize: NOTIFICATIONS_PAGE_SIZE }),
    getNextPageParam: (last: NotificationPage, pages) =>
      pages.reduce((loaded, page) => loaded + page.items.length, 0) < last.totalCount && last.items.length > 0 ? last.page + 1 : undefined,
    enabled,
    staleTime: 0,
    refetchOnMount: 'always',
    retry: retryTransientErrors(1),
  });
}

/** Marks one notification as read; the count and the list are read again. */
export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSettled: () => queryClient.invalidateQueries({ queryKey: [NOTIFICATIONS_QUERY] }),
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => queryClient.setQueryData(UNREAD_COUNT_KEY, 0),
    onSettled: () => queryClient.invalidateQueries({ queryKey: [NOTIFICATIONS_QUERY] }),
  });
}
