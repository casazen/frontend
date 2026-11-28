import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { octorateApi } from '@/api/octorate.api';

const OCTORATE_CONNECTION_KEY = ['octorate', 'connection'] as const;

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

export function useStartOctorateConnect() {
  return useMutation({
    mutationFn: () => octorateApi.startConnect(),
    gcTime: 0,
  });
}

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
