import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { alloggiatiApi } from '@/api/alloggiati.api';
import { toast } from 'sonner';
import i18n from '@/i18n/config';
import { getProblemMessage } from '@/lib/api-errors';

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

export function useAlloggiatiGuestSummary(bookingId: string) {
  return useQuery({
    queryKey: [ALLOGGIATI_KEY, 'guest-summary', bookingId],
    queryFn: () => alloggiatiApi.getGuestSummary(bookingId),
    enabled: !!bookingId,
  });
}

export function useMarkAlloggiatiSentManually() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ bookingId, sentOn }: { bookingId: string; sentOn: string }) =>
      alloggiatiApi.markSentManually(bookingId, { sentOn }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ALLOGGIATI_KEY] });
      queryClient.invalidateQueries({ queryKey: ['compliance'] });
      toast.success(i18n.t('toast.alloggiatiMarkedSent'));
    },
    onError: (error) => {
      toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('toast.alloggiatiMarkSentFailed'));
    },
  });
}
