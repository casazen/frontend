import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import { publicBookingApi } from '@/api/public-booking.api';
import type { CreateDirectBookingPayload, DirectBookingQuotePayload } from '@/types';

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

/**
 * Checkout price from the backend (`POST /public/bookings/quote`). `null` while the stay is incomplete.
 * The previous quote stays visible while a new one loads.
 */
export function useDirectBookingQuote(payload: DirectBookingQuotePayload | null) {
  return useQuery({
    queryKey: ['public-booking-quote', payload],
    queryFn: () => publicBookingApi.quoteDirectBooking(payload!),
    enabled: payload !== null,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    retry: false,
  });
}
