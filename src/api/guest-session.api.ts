import { ApiClient } from './client';
import type { CheckoutPaymentSession, GuestBookingDetails, GuestBookingLookupPayload, GuestSession } from '@/types';

/**
 * The header a guest-area call carries (DB-06a): the token of the guest session. The calls of the guest area are anonymous for the
 * hosts' sign-in (`public: true`: no access token of a signed-in user is attached) and send this one instead. The features that
 * live in the guest area (messages, reviews…) add their calls here and use the same header; it only goes to `/public/guest/*`.
 */
export function guestSessionHeaders(accessToken: string): Record<string, string> {
  return { Authorization: `Bearer ${accessToken}` };
}

export const guestSessionApi = {
  /**
   * Opens a guest session with the booking code and the email the booking was made with, in the body (never in a URL). 404
   * `guest_booking_not_found` whatever does not match (the same answer for a wrong code, a wrong email and another site); 429
   * `rate_limited` with `retryAfterSeconds`.
   */
  openSession: (payload: GuestBookingLookupPayload) =>
    ApiClient.post<GuestSession>('/public/guest/session', payload, { public: true }),

  /**
   * The booking of the session as "Le mie prenotazioni" shows it. 401 when the token is missing, altered or expired (the guest
   * proves the booking again); 404 `guest_booking_not_found` when the code is not one of this guest's bookings on this site.
   */
  getBooking: (accessToken: string, bookingCode: string) =>
    ApiClient.get<GuestBookingDetails>(`/public/guest/bookings/${encodeURIComponent(bookingCode)}`, undefined, {
      public: true,
      headers: guestSessionHeaders(accessToken),
    }),

  /**
   * Pays the booking of the session again (a declined card, a page closed before paying): the client secret of the booking's own
   * intent, so nothing is booked twice. 401 as above; 409 `checkout_hold_expired` once the dates were released, 409
   * `checkout_payment_not_resumable` when there is nothing left to pay.
   */
  resumePayment: (accessToken: string, bookingCode: string) =>
    ApiClient.post<CheckoutPaymentSession>(
      `/public/guest/bookings/${encodeURIComponent(bookingCode)}/payment-session`,
      undefined,
      { public: true, headers: guestSessionHeaders(accessToken) },
    ),
};
