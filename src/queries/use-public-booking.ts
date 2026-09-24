import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import { publicBookingApi } from '@/api/public-booking.api';
import { isTransientRequestError } from '@/lib/api-errors';
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

/**
 * Real state of a checkout (BK-07), read with its checkout token. The outcome page drives the polling (backoff while the
 * state is intermediate). Network errors are retried a few times; a 4xx (wrong link) is not.
 */
export function useCheckoutOutcome(bookingId: string, token: string) {
  return useQuery({
    queryKey: ['checkout-outcome', bookingId, token] as const,
    queryFn: () => publicBookingApi.getCheckoutOutcome(bookingId, token),
    enabled: bookingId !== '' && token !== '',
    staleTime: 0,
    retry: (failureCount, error) => isTransientRequestError(error) && failureCount < 3,
  });
}

/** The client secret of the booking's own intent, to pay the same hold again (BK-07); errors are shown by the page. */
export function useResumeCheckoutPayment() {
  return useMutation({
    mutationFn: ({ bookingId, token }: { bookingId: string; token: string }) =>
      publicBookingApi.resumeCheckoutPayment(bookingId, token),
  });
}
