import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ConnectApi } from '@/api/connect.api';

export const CONNECT_STATUS_KEY = ['connect', 'status'] as const;

export function useConnectStatus(refresh = true, enabled = true) {
  return useQuery({
    queryKey: [...CONNECT_STATUS_KEY, refresh],
    queryFn: () => ConnectApi.getStatus(refresh),
    enabled,
  });
}

export function useStartConnectOnboarding() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => ConnectApi.createOnboardingLink(),
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: CONNECT_STATUS_KEY });
      window.location.assign(data.url);
    },
  });
}

/**
 * Opens the Express Dashboard of the org's Stripe account (AM-08b-d, «Gestisci su Stripe»): the API gives a single-use login link, which
 * is followed at once and never kept. Errors are shown by the page (a 422 says the account is not ready: connect it or finish the
 * verification first).
 */
export function useOpenStripeDashboard() {
  return useMutation({
    mutationFn: () => ConnectApi.createDashboardLink(),
    gcTime: 0,
    onSuccess: (data) => {
      window.location.assign(data.url);
    },
  });
}
