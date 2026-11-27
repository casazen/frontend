import { UnexpectedApiResponseError } from '@/lib/api-errors';
import type { NotificationPreferences, SaveNotificationPreferencesRequest } from '@/types';
import { ApiClient } from './client';

const PATH = '/me/notification-preferences';

/** A body that is not the settings (the SPA's `index.html` behind a wrong rewrite) is a load error, not a page with no rows. */
function ensurePreferences(data: NotificationPreferences | undefined): NotificationPreferences {
  if (!data || !Array.isArray(data.events) || !Array.isArray(data.availableChannels) || !data.quietHours) {
    throw new UnexpectedApiResponseError(PATH);
  }
  return data;
}

/**
 * How the signed-in user wants to be alerted (E05/F03, NF-65): always the caller's own settings, the API reads the user from the token and
 * the address has no user in it. Enums are names (`NewGuestMessage`, `MobilePush`), times are `HH:mm:ss`.
 */
export const notificationPreferencesApi = {
  /** The quiet hours, one entry for each kind of event (what the caller chose, or the defaults, marked as such) and the channels that deliver. */
  get: async (): Promise<NotificationPreferences> => ensurePreferences(await ApiClient.get<NotificationPreferences | undefined>(PATH)),

  /**
   * Saves the quiet hours and/or the channels of the kinds of event given (the others stay as they are) and answers with the settings after the
   * save. 422 `notification_legal_channel_required` when the legal deadline would be left with no channel, 422 `notification_channel_unavailable`
   * for a channel that cannot deliver (browser push).
   */
  save: async (request: SaveNotificationPreferencesRequest): Promise<NotificationPreferences> =>
    ensurePreferences(await ApiClient.put<NotificationPreferences | undefined>(PATH, request)),
};
