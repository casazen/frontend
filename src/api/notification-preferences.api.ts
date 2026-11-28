import { UnexpectedApiResponseError } from '@/lib/api-errors';
import type { NotificationPreferences, SaveNotificationPreferencesRequest } from '@/types';
import { ApiClient } from './client';

const PATH = '/me/notification-preferences';

function ensurePreferences(data: NotificationPreferences | undefined): NotificationPreferences {
  if (!data || !Array.isArray(data.events) || !Array.isArray(data.availableChannels) || !data.quietHours) {
    throw new UnexpectedApiResponseError(PATH);
  }
  return data;
}

export const notificationPreferencesApi = {
  get: async (): Promise<NotificationPreferences> => ensurePreferences(await ApiClient.get<NotificationPreferences | undefined>(PATH)),

  save: async (request: SaveNotificationPreferencesRequest): Promise<NotificationPreferences> =>
    ensurePreferences(await ApiClient.put<NotificationPreferences | undefined>(PATH, request)),
};
