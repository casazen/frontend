import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { NOTIFICATIONS_PAGE_SIZE, notificationsApi, type NotificationPage } from '@/api/notifications.api';
import { retryTransientErrors } from '@/lib/query-client';

export const NOTIFICATIONS_QUERY = 'notifications';
export const UNREAD_COUNT_KEY = [NOTIFICATIONS_QUERY, 'unread-count'] as const;
const LIST_KEY = [NOTIFICATIONS_QUERY, 'list'] as const;

const DISCONNECTED_POLL_MS = 60_000;

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
