import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ConnectApi } from '@/api/connect.api';

export const CONNECT_STATUS_KEY = ['connect', 'status'] as const;

export function useConnectStatus(refresh = true) {
  return useQuery({
    queryKey: [...CONNECT_STATUS_KEY, refresh],
    queryFn: () => ConnectApi.getStatus(refresh),
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
