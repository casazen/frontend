import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { bookingFlowSettingsApi } from '@/api/booking-flow-settings.api';
import i18n from '@/i18n/config';
import { retryTransientErrors } from '@/lib/query-client';
import type { UpdateBookingFlowSettingsRequest } from '@/types/booking-flow.types';

export const BOOKING_FLOW_QUERY_KEY = ['org-settings', 'booking-flow'] as const;

export function useBookingFlowSettings(enabled = true) {
  return useQuery({
    queryKey: BOOKING_FLOW_QUERY_KEY,
    queryFn: () => bookingFlowSettingsApi.get(),
    enabled,
    staleTime: 5 * 60 * 1000,
    retry: retryTransientErrors(1),
  });
}

export function useUpdateBookingFlowSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: UpdateBookingFlowSettingsRequest) => bookingFlowSettingsApi.update(request),
    onSuccess: (settings) => {
      queryClient.setQueryData(BOOKING_FLOW_QUERY_KEY, settings);
      toast.success(i18n.t('bookingFlow.saved'));
    },
  });
}
