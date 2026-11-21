import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { bookingFlowSettingsApi } from '@/api/booking-flow-settings.api';
import i18n from '@/i18n/config';
import { retryTransientErrors } from '@/lib/query-client';
import type { UpdateBookingFlowSettingsRequest } from '@/types/booking-flow.types';

export const BOOKING_FLOW_QUERY_KEY = ['org-settings', 'booking-flow'] as const;

/**
 * The steps of the stays of the caller's organization (casazen/backend#978): the page «Flusso» and the step of a booking read them. Kept for a few minutes: they change
 * rarely, and the page that changes them writes the answer of the server here.
 */
export function useBookingFlowSettings(enabled = true) {
  return useQuery({
    queryKey: BOOKING_FLOW_QUERY_KEY,
    queryFn: () => bookingFlowSettingsApi.get(),
    enabled,
    staleTime: 5 * 60 * 1000,
    retry: retryTransientErrors(1),
  });
}

/** Saves the settings; the answer is the settings in force and replaces what the screens show. What the server refused is told by the page, from the error. */
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
