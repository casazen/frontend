import { ApiClient } from './client';
import type {
  CreateDirectBookingPayload,
  DirectBookingQuote,
  DirectBookingQuotePayload,
  DirectBookingResponse,
  GuestBookingDetails,
  GuestBookingEmailLookup,
  CheckoutOutcome,
  CheckoutPaymentSession,
  OnSiteRequestConfirmation,
} from '@/types';

export const publicBookingApi = {
  createDirectBooking: (payload: CreateDirectBookingPayload) =>
    ApiClient.post<DirectBookingResponse>('/public/bookings', payload, { public: true }),

  quoteDirectBooking: (payload: DirectBookingQuotePayload, signal?: AbortSignal) =>
    ApiClient.post<DirectBookingQuote>('/public/bookings/quote', payload, { public: true, signal }),

  /**
   * "Le mie prenotazioni" (BK-11): the booking of this site with its code and the guest's email, in the body (never in the
   * URL). 404 `guest_booking_not_found` whatever does not match; 429 `rate_limited`. The page no longer uses it: it opens a guest
   * session once and reads the booking with its token (`guestSessionApi`, DB-06c); the endpoint stays for compatibility.
   */
  lookupGuestBooking: (payload: GuestBookingEmailLookup) =>
    ApiClient.post<GuestBookingDetails>('/public/bookings/lookup', payload, { public: true }),

  sendGuestCheckInLink: (payload: GuestBookingEmailLookup) =>
    ApiClient.post<void>('/public/bookings/lookup/check-in-link', payload, { public: true }),

  getCheckoutOutcome: (bookingId: string, token: string) =>
    ApiClient.post<CheckoutOutcome>(
      `/public/bookings/${encodeURIComponent(bookingId)}/outcome`,
      { token },
      { public: true },
    ),

  resumeCheckoutPayment: (bookingId: string, token: string) =>
    ApiClient.post<CheckoutPaymentSession>(
      `/public/bookings/${encodeURIComponent(bookingId)}/payment-session`,
      { token },
      { public: true },
    ),

  confirmOnSiteRequestEmail: (bookingId: string, token: string) =>
    ApiClient.post<OnSiteRequestConfirmation>(
      `/public/bookings/${bookingId}/confirm-email`,
      { token },
      { public: true },
    ),
};
