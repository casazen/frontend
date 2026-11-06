import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { octorateApi } from '@/api/octorate.api';

export const OCTORATE_CONNECTION_KEY = ['octorate', 'connection'] as const;

/**
 * Where the connection of the org to its channel manager stands. Reading it makes a call to the channel manager (its quota), so it is
 * read again when a screen opens and not at every focus of the window; the screens that change it (the consent, the disconnection)
 * invalidate it.
 */
export function useOctorateConnection(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: OCTORATE_CONNECTION_KEY,
    queryFn: () => octorateApi.getConnectionStatus(),
    enabled: options?.enabled ?? true,
    staleTime: 30_000,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });
}

/**
 * Starts a consent: the API answers the address of the page of the channel manager, which carries the single-use state of this consent.
 * The caller opens it at once in the same tab; the mutation does not keep the answer once nobody watches it (`gcTime: 0`).
 */
export function useStartOctorateConnect() {
  return useMutation({
    mutationFn: () => octorateApi.startConnect(),
    gcTime: 0,
  });
}

/**
 * Completes the consent with the code and the state of the callback. Both are used once: the mutation does not keep them once nobody
 * watches it (`gcTime: 0`). The connection is read again afterwards.
 */
export function useCompleteOctorateConnect() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ code, state }: { code: string; state: string }) => octorateApi.completeConnect(code, state),
    gcTime: 0,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: OCTORATE_CONNECTION_KEY });
    },
  });
}
