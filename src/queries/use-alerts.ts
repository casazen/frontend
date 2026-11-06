import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { alertsApi } from '@/api/alerts.api';
import { parseAlert } from '@/features/notifications/realtime-client';
import i18n from '@/i18n/config';
import { getHttpStatus, getProblemMessage } from '@/lib/api-errors';
import { retryTransientErrors } from '@/lib/query-client';
import type { PendingAlert } from '@/types/alert';

/** Root of the popup alert queries. */
export const ALERTS_QUERY = 'alerts';
export const PENDING_ALERTS_KEY = [ALERTS_QUERY, 'pending'] as const;

/** While the real-time channel is down, the alerts that wait for an answer are read again at this pace (ADR-025-R6). */
export const ALERT_POLL_MS = 30_000;

/**
 * The alerts waiting for an answer, as the server lists them. The real-time channel adds the alerts it pushes to this same list
 * (`useAlertSignalr`); `pollWhileDisconnected` reads it every {@link ALERT_POLL_MS} for as long as the socket is down. The window
 * focus and the network coming back read it again too, and so does the hook when the channel is up. An item that is not the
 * contract is left out, like a payload of the channel.
 */
export function usePendingAlerts({ pollWhileDisconnected }: { pollWhileDisconnected: boolean }) {
  return useQuery({
    queryKey: PENDING_ALERTS_KEY,
    queryFn: async () => (await alertsApi.getPendingAlerts()).flatMap((item) => parseAlert(item) ?? []),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchInterval: pollWhileDisconnected ? ALERT_POLL_MS : false,
    retry: retryTransientErrors(1),
  });
}

/** The next alert shows as soon as the server has the answer, without waiting for the list to be read again. */
function dropFromQueue(queryClient: QueryClient, alertId: string): void {
  queryClient.setQueryData<PendingAlert[]>(PENDING_ALERTS_KEY, (alerts) => alerts?.filter((alert) => alert.alertId !== alertId));
}

/**
 * «Ignora»: the server closes the alert and it leaves the queue. If the server does not take the answer the alert stays, with a
 * message. The list is read again whatever the answer: an alert that is not there any more (404, answered on another device) is
 * taken off the screen by that read, and nothing is told about it.
 */
export function useDismissAlert() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (alertId: string) => alertsApi.dismissAlert(alertId),
    onSuccess: (_result, alertId) => dropFromQueue(queryClient, alertId),
    onError: (error) => {
      if (getHttpStatus(error) === 404) return;
      toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('alert.popup.dismissError'));
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: PENDING_ALERTS_KEY });
    },
  });
}

/**
 * «Ricordamelo più tardi»: the server snoozes the alert until `remindAt` (ISO 8601) and it leaves the queue; it comes back when the
 * time has come. A moment after the deadline of the alert is refused by the server (400): its message is the one shown, and the alert
 * stays. Same read of the list afterwards as {@link useDismissAlert}.
 */
export function useRemindAlert() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ alertId, remindAt }: { alertId: string; remindAt: string }) => alertsApi.remindAlert(alertId, remindAt),
    onSuccess: (_result, { alertId }) => dropFromQueue(queryClient, alertId),
    onError: (error) => {
      if (getHttpStatus(error) === 404) return;
      toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('alert.popup.remindError'));
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: PENDING_ALERTS_KEY });
    },
  });
}
