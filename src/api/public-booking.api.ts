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

  /**
   * Price of the stay computed by the backend, tourist tax included (BK-03): the amounts the booking records. `signal` cancels the
   * request when the stay changes before the answer: an old answer never takes the place of the new one.
   */
  quoteDirectBooking: (payload: DirectBookingQuotePayload, signal?: AbortSignal) =>
    ApiClient.post<DirectBookingQuote>('/public/bookings/quote', payload, { public: true, signal }),

  /**
   * "Le mie prenotazioni" (BK-11): the booking of this site with its code and the guest's email, in the body (never in the
   * URL). 404 `guest_booking_not_found` whatever does not match; 429 `rate_limited`. The page no longer uses it: it opens a guest
   * session once and reads the booking with its token (`guestSessionApi`, DB-06c); the endpoint stays for compatibility.
   */
  lookupGuestBooking: (payload: GuestBookingEmailLookup) =>
    ApiClient.post<GuestBookingDetails>('/public/bookings/lookup', payload, { public: true }),

  /** Emails the online check-in link again to the address of the booking (202); 409 `guest_check_in_link_unavailable`. */
  sendGuestCheckInLink: (payload: GuestBookingEmailLookup) =>
    ApiClient.post<void>('/public/bookings/lookup/check-in-link', payload, { public: true }),

  /**
   * Real state of a checkout for its outcome page (BK-07). The checkout token goes in the body, never in the URL of the
   * API call; a wrong id or token answers 404 `checkout_link_invalid`.
   */
  getCheckoutOutcome: (bookingId: string, token: string) =>
    ApiClient.post<CheckoutOutcome>(
      `/public/bookings/${encodeURIComponent(bookingId)}/outcome`,
      { token },
      { public: true },
    ),

  /** Client secret of the booking's own intent, to pay the same hold again (409 `checkout_hold_expired` once released). */
  resumeCheckoutPayment: (bookingId: string, token: string) =>
    ApiClient.post<CheckoutPaymentSession>(
      `/public/bookings/${encodeURIComponent(bookingId)}/payment-session`,
      { token },
      { public: true },
    ),

  /** The guest confirms the email of a "pay at the property" request with the token of the link (BK-06). */
  confirmOnSiteRequestEmail: (bookingId: string, token: string) =>
    ApiClient.post<OnSiteRequestConfirmation>(
      `/public/bookings/${bookingId}/confirm-email`,
      { token },
      { public: true },
    ),
};
