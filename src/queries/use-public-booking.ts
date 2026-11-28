import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import { publicBookingApi } from '@/api/public-booking.api';
import { isTransientRequestError } from '@/lib/api-errors';
import type { CreateDirectBookingPayload, DirectBookingQuotePayload, GuestBookingEmailLookup } from '@/types';

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

export function useDirectBookingQuote(payload: DirectBookingQuotePayload | null) {
  return useQuery({
    queryKey: ['public-booking-quote', payload],
    queryFn: ({ signal }) => publicBookingApi.quoteDirectBooking(payload!, signal),
    enabled: payload !== null,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    retry: false,
  });
}

export function useCheckoutOutcome(bookingId: string, token: string) {
  return useQuery({
    queryKey: ['checkout-outcome', bookingId, token] as const,
    queryFn: () => publicBookingApi.getCheckoutOutcome(bookingId, token),
    enabled: bookingId !== '' && token !== '',
    staleTime: 0,
    retry: (failureCount, error) => isTransientRequestError(error) && failureCount < 3,
  });
}

export function useResumeCheckoutPayment() {
  return useMutation({
    mutationFn: ({ bookingId, token }: { bookingId: string; token: string }) =>
      publicBookingApi.resumeCheckoutPayment(bookingId, token),
  });
}

export function useSendGuestCheckInLink() {
  return useMutation({
    mutationFn: (payload: GuestBookingEmailLookup) => publicBookingApi.sendGuestCheckInLink(payload),
  });
}
