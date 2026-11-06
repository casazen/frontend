import { useEffect, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { orderAlerts, upsertAlert } from '@/features/notifications/alert-model';
import { useNotificationsRealtime } from '@/features/notifications/use-notifications-realtime';
import { PENDING_ALERTS_KEY, useDismissAlert, usePendingAlerts, useRemindAlert } from '@/queries/use-alerts';
import type { PendingAlert } from '@/types/alert';

interface Options {
  /** The signed-in user of the real app: the popup is never mounted for a guest, a public page, the demo or a signed-out session. */
  userId: string;
  getAccessToken: () => Promise<string | undefined>;
}

/**
 * The queue of the popup alerts (ADR-025). It opens no connection of its own: the alerts ride on the channel the bell already keeps
 * (`/hubs/notifications`, one per tab), as the second method `alertReceived`. An alert that is pushed goes into the queue at once, and
 * the queue is read again right after it (a read that started before the alert would otherwise put its older answer over the queue);
 * with the socket down, or not up yet, the queue is read from `GET /api/me/alerts/pending` every 30 seconds, and once more each
 * time the channel comes up, because what was pushed while it was down (or before it was up) is not sent again.
 *
 * `alerts` is the whole queue, the most urgent first, and `currentAlert` the one to show: one at a time. Answering it
 * (`dismissCurrent`, `remindCurrent`) shows the next. Whether the popup may be drawn (not during a wizard) is for the component to say.
 */
export function useAlertSignalr({ userId, getAccessToken }: Options) {
  const queryClient = useQueryClient();

  const channel = useNotificationsRealtime({
    enabled: true,
    userId,
    getAccessToken,
    // The notifications of the bell are fed by the bell's own use of the channel.
    alertsOnly: true,
    onAlert: (alert) => {
      queryClient.setQueryData<PendingAlert[]>(PENDING_ALERTS_KEY, (alerts) => upsertAlert(alerts ?? [], alert));
      // A read of the list that started before this alert would put its older answer over the queue and take the alert out of it (with
      // the channel up nothing else reads the list again). Reading it again, which the server can answer with the alert already in it,
      // drops the answer in flight.
      void queryClient.invalidateQueries({ queryKey: PENDING_ALERTS_KEY });
    },
  });
  const pending = usePendingAlerts({ pollWhileDisconnected: channel !== 'connected' });
  const dismiss = useDismissAlert();
  const remind = useRemindAlert();

  const { refetch } = pending;
  useEffect(() => {
    if (channel === 'connected') void refetch();
  }, [channel, refetch]);

  const alerts = useMemo(() => orderAlerts(pending.data ?? []), [pending.data]);
  const currentAlert = alerts[0] ?? null;
  // One answer at a time: while the server has not taken one, the next alert (which is already there) waits for its turn, so that
  // a second click on the same button does not answer an alert the person has not read yet.
  const busy = dismiss.isPending || remind.isPending;

  return {
    alerts,
    currentAlert,
    busy,
    dismissCurrent: () => {
      if (currentAlert && !busy) dismiss.mutate(currentAlert.alertId);
    },
    remindCurrent: (remindAt: Date) => {
      if (currentAlert && !busy) remind.mutate({ alertId: currentAlert.alertId, remindAt: remindAt.toISOString() });
    },
  };
}
