import { ApiClient } from './client';

export interface InAppNotification {
  id: string;
  type: string;
  entityId: string | null;
  createdAt: string;
  readAt: string | null;
}

export interface NotificationPage {
  items: InAppNotification[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export const NOTIFICATIONS_PAGE_SIZE = 20;

export const notificationsApi = {
  list: (params: { unread?: boolean; page?: number; pageSize?: number } = {}) =>
    ApiClient.get<NotificationPage>('/me/notifications', params),

  unreadCount: () => ApiClient.get<{ count: number }>('/me/notifications/unread-count'),

  markRead: (id: string) => ApiClient.post<void>(`/me/notifications/${encodeURIComponent(id)}/read`),

  markAllRead: () => ApiClient.post<void>('/me/notifications/read-all'),
};
