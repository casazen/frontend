import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ConnectApi } from '@/api/connect.api';

export const CONNECT_STATUS_KEY = ['connect', 'status'] as const;

/** `enabled` false reads nothing: a page that shows the payments only to some people asks for the status only for them. */
export function useConnectStatus(refresh = true, enabled = true) {
  return useQuery({
    queryKey: [...CONNECT_STATUS_KEY, refresh],
    queryFn: () => ConnectApi.getStatus(refresh),
    enabled,
  });
}

/**
 * Starts (or resumes) the Stripe Connect onboarding: the API creates the account when missing and returns the
 * Account Link, whose return pages it builds itself. Errors are shown by the page (with "Riprova" when retryable).
 */
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
    // The link is a credential: the mutation does not keep its answer once nobody watches it (`gcTime: 0`).
    gcTime: 0,
    onSuccess: (data) => {
      window.location.assign(data.url);
    },
  });
}
