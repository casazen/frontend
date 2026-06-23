import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { alloggiatiApi } from '@/api/alloggiati.api';
import { toast } from 'sonner';
import i18n from '@/i18n/config';

const ALLOGGIATI_KEY = 'alloggiati';

export function useAlloggiatiSummary(propertyId?: string) {
  return useQuery({
    queryKey: [ALLOGGIATI_KEY, 'summary', propertyId ?? 'all'],
    queryFn: () => alloggiatiApi.getSummary(propertyId),
  });
}

export function useAlloggiatiStatus(bookingId: string) {
  return useQuery({
    queryKey: [ALLOGGIATI_KEY, 'status', bookingId],
    queryFn: () => alloggiatiApi.getStatus(bookingId),
    enabled: !!bookingId,
  });
}

export function useResendAlloggiatiReport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (bookingId: string) => alloggiatiApi.sendReport(bookingId),
    onSuccess: (_, bookingId) => {
      queryClient.invalidateQueries({ queryKey: [ALLOGGIATI_KEY] });
      queryClient.invalidateQueries({ queryKey: [ALLOGGIATI_KEY, 'status', bookingId] });
      toast.success(i18n.t('toast.alloggiatiSent'));
    },
    onError: () => {
      toast.error(i18n.t('toast.alloggiatiSendFailed'));
    },
  });
}
