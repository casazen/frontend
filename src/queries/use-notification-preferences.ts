import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { notificationPreferencesApi } from '@/api/notification-preferences.api';
import i18n from '@/i18n/config';
import { getProblemMessage } from '@/lib/api-errors';
import type { SaveNotificationPreferencesRequest } from '@/types';

export const NOTIFICATION_PREFERENCES_KEY = ['notification-preferences'] as const;

/** One id for the confirmation: a run of quick changes replaces the message instead of piling up a toast for each switch. */
const SAVED_TOAST_ID = 'notification-preferences-saved';

/**
 * The alert settings of the caller (E05/F03, NF-65). They can change on another device, so they are read again whenever the page opens
 * and the window comes back: the page builds the channels of a row from them, and a stale row would write over a change made elsewhere.
 */
export function useNotificationPreferences() {
  return useQuery({
    queryKey: NOTIFICATION_PREFERENCES_KEY,
    queryFn: () => notificationPreferencesApi.get(),
    staleTime: 0,
    refetchOnMount: 'always',
  });
}

/**
 * Saves the channels of one kind of event, or the quiet hours (`SaveNotificationPreferencesRequest`). The mutation stays pending until the
 * settings have been read again, so the page keeps showing the value being saved (`variables`) and never flips back for a moment. A refused
 * save says why with the problem message of the API (the legal deadline left with no channel, a channel that cannot deliver).
 */
export function useSaveNotificationPreferences() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: SaveNotificationPreferencesRequest) => notificationPreferencesApi.save(request),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: NOTIFICATION_PREFERENCES_KEY });
      toast.success(i18n.t('notificationPreferences.saved'), { id: SAVED_TOAST_ID });
    },
    onError: (error) => toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('notificationPreferences.saveFailed')),
  });
}
