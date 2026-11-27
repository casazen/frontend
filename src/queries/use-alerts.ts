import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { alertsApi } from '@/api/alerts.api';
import { parseAlert } from '@/features/notifications/realtime-client';
import i18n from '@/i18n/config';
import { getHttpStatus, getProblemMessage } from '@/lib/api-errors';
import { retryTransientErrors } from '@/lib/query-client';
import type { PendingAlert } from '@/types/alert';

const ALERTS_QUERY = 'alerts';
export const PENDING_ALERTS_KEY = [ALERTS_QUERY, 'pending'] as const;

const ALERT_POLL_MS = 30_000;

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

function dropFromQueue(queryClient: QueryClient, alertId: string): void {
  queryClient.setQueryData<PendingAlert[]>(PENDING_ALERTS_KEY, (alerts) => alerts?.filter((alert) => alert.alertId !== alertId));
}

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
