import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { checkinApi } from '@/api/checkin.api';
import type { SubmitGuestCheckInRequest } from '@/types/alloggiati.types';
import { toast } from 'sonner';

const CHECKIN_KEY = 'checkin';

export function useCheckInContext(token: string) {
  return useQuery({
    queryKey: [CHECKIN_KEY, token],
    queryFn: () => checkinApi.getContext(token),
    enabled: !!token,
    retry: 1,
  });
}

export function useSubmitGuestCheckIn(token: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: SubmitGuestCheckInRequest) => checkinApi.submitGuestData(token, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CHECKIN_KEY, token] });
      toast.success('Dati registrati con successo');
    },
    onError: () => {
      toast.error('Impossibile salvare i dati. Verifica i campi e riprova.');
    },
  });
}

export function useUploadCheckInDocument(token: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (file: File) => checkinApi.uploadDocument(token, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CHECKIN_KEY, token] });
      toast.success('Documento caricato');
    },
    onError: () => {
      toast.error('Caricamento documento non riuscito');
    },
  });
}
