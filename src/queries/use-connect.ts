import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ConnectApi } from '@/api/connect.api';
import { toast } from 'sonner';

export const CONNECT_STATUS_KEY = ['connect', 'status'] as const;

export function useConnectStatus(refresh = true) {
  return useQuery({
    queryKey: [...CONNECT_STATUS_KEY, refresh],
    queryFn: () => ConnectApi.getStatus(refresh),
  });
}

export function useStartConnectOnboarding() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const base = `${window.location.origin}/app/short-rent/settings/payments`;
      const returnUrl = `${base}?stripe_return=1`;
      const refreshUrl = `${base}?stripe_refresh=1`;
      await ConnectApi.createAccount();
      return ConnectApi.createOnboardingLink(returnUrl, refreshUrl);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: CONNECT_STATUS_KEY });
      window.location.assign(data.url);
    },
    onError: () => {
      toast.error('Impossibile avviare la connessione con Stripe');
    },
  });
}
