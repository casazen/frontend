import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { publicCheckinApi } from '@/api/checkin.api';
import { bookingsApi } from '@/api/bookings.api';
import type { PublicCheckInSubmitRequest } from '@/types/public-checkin.types';
import { toast } from 'sonner';
import i18n from '@/i18n/config';

const CHECKIN_KEY = 'checkin';
const CHECKIN_SESSION_KEY = 'checkin-session';

export function useCheckInContext(token: string) {
  return useQuery({
    queryKey: [CHECKIN_KEY, token],
    queryFn: () => publicCheckinApi.getContext(token),
    enabled: !!token,
    retry: 1,
  });
}

export function useSubmitGuestCheckIn(token: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: PublicCheckInSubmitRequest) => publicCheckinApi.submit(token, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CHECKIN_KEY, token] });
      toast.success(i18n.t('toast.checkInDataSaved'));
    },
    onError: () => {
      toast.error(i18n.t('toast.checkInDataSaveFailed'));
    },
  });
}

export function useBookingCheckInSession(bookingId: string) {
  return useQuery({
    queryKey: [CHECKIN_SESSION_KEY, bookingId],
    queryFn: () => bookingsApi.getCheckInSession(bookingId),
    enabled: !!bookingId,
  });
}

export function useResendCheckInLink(bookingId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => bookingsApi.resendCheckInLink(bookingId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CHECKIN_SESSION_KEY, bookingId] });
      toast.success(i18n.t('checkin.resendSuccess'));
    },
    onError: () => {
      toast.error(i18n.t('checkin.resendError'));
    },
  });
}
