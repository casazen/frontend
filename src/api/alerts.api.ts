import { UnexpectedApiResponseError } from '@/lib/api-errors';
import type { PendingAlert } from '@/types/alert';
import { ApiClient } from './client';

export const alertsApi = {
  getPendingAlerts: async (): Promise<PendingAlert[]> => {
    const data = await ApiClient.get<unknown>('/me/alerts/pending');
    if (!Array.isArray(data)) throw new UnexpectedApiResponseError('/me/alerts/pending');
    return data as PendingAlert[];
  },

  dismissAlert: (id: string) => ApiClient.post<void>(`/me/alerts/${encodeURIComponent(id)}/dismiss`, {}),

  remindAlert: (id: string, remindAt: string) =>
    ApiClient.patch<void>(`/me/alerts/${encodeURIComponent(id)}/remind`, { remindAt }),
};
