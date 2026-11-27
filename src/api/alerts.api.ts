import { UnexpectedApiResponseError } from '@/lib/api-errors';
import type { PendingAlert } from '@/types/alert';
import { ApiClient } from './client';

/**
 * The popup alerts of the signed-in user (ADR-025, `/api/me/alerts`): always the caller's own, never another user's. The paths are
 * relative to the API base URL, which already ends in `/api`.
 */
export const alertsApi = {
  /**
   * The caller's alerts that are waiting for an answer (not dismissed, and not snoozed any more), the most urgent first and the
   * oldest first among the same urgency. The server has already left out what the caller's scope does not reach.
   */
  getPendingAlerts: async (): Promise<PendingAlert[]> => {
    const data = await ApiClient.get<unknown>('/me/alerts/pending');
    if (!Array.isArray(data)) throw new UnexpectedApiResponseError('/me/alerts/pending');
    return data as PendingAlert[];
  },

  /** «Ignora»: the alert is closed for good. The body is empty on purpose (`DismissRequest`). */
  dismissAlert: (id: string) => ApiClient.post<void>(`/me/alerts/${encodeURIComponent(id)}/dismiss`, {}),

  /** «Ricordamelo più tardi»: the alert comes back at `remindAt` (ISO 8601); the server refuses a moment after the deadline of the alert (400). */
  remindAlert: (id: string, remindAt: string) =>
    ApiClient.patch<void>(`/me/alerts/${encodeURIComponent(id)}/remind`, { remindAt }),
};
