import { ApiClient } from './client';

/**
 * One notification of the bell (`GET /api/me/notifications`). `type` is a push type of the backend (`new-booking`,
 * `guest-message`, `service-request-taken`, …) and may be one this version of the app does not know; `entityId` is the
 * booking, or the service request for the `service-request-*` types.
 */
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

/** The notifications of the signed-in user, for the bell: always the caller's own, never another user's. */
export const notificationsApi = {
  list: (params: { unread?: boolean; page?: number; pageSize?: number } = {}) =>
    ApiClient.get<NotificationPage>('/me/notifications', params),

  unreadCount: () => ApiClient.get<{ count: number }>('/me/notifications/unread-count'),

  markRead: (id: string) => ApiClient.post<void>(`/me/notifications/${encodeURIComponent(id)}/read`),

  markAllRead: () => ApiClient.post<void>('/me/notifications/read-all'),
};
