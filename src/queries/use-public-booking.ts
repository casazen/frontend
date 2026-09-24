import { useMutation } from '@tanstack/react-query';
import { publicBookingApi } from '@/api/public-booking.api';
import type { CreateDirectBookingPayload } from '@/types';

/** Confirms the email of a "pay at the property" request (BK-06); errors are shown by the page. */
export function useConfirmOnSiteRequestEmail() {
  return useMutation({
    mutationFn: ({ bookingId, token }: { bookingId: string; token: string }) =>
      publicBookingApi.confirmOnSiteRequestEmail(bookingId, token),
  });
}

export function useCreateDirectBooking() {
  return useMutation({
    mutationFn: (payload: CreateDirectBookingPayload) =>
      publicBookingApi.createDirectBooking(payload),
  });
}
