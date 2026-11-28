import { ApiClient } from './client';
import type { GuestBookingDetails, GuestBookingLookupPayload, GuestSession } from '@/types';

export function guestSessionHeaders(accessToken: string): Record<string, string> {
  return { Authorization: `Bearer ${accessToken}` };
}

export const guestSessionApi = {
  /**
   * Opens a guest session with the booking code and ONE proof, in the body (never in a URL): the email the booking was made with or, behind the flag `whiteLabelHost`, the last four
   * digits of the guest's phone (NF-143). The object is posted as it is, so with the phone the key `email` is absent (the backend takes exactly one of the two). 404
   * `guest_booking_not_found` whatever does not match (the same answer for a wrong code, a wrong email or phone, a booking without a phone and another site); 429
   * `rate_limited` with `retryAfterSeconds` (the per-IP limit, or the lock of the code after repeated failures, which names the whole window).
   */
  openSession: (payload: GuestBookingLookupPayload) =>
    ApiClient.post<GuestSession>('/public/guest/session', payload, { public: true }),

  getBooking: (accessToken: string, bookingCode: string) =>
    ApiClient.get<GuestBookingDetails>(`/public/guest/bookings/${encodeURIComponent(bookingCode)}`, undefined, {
      public: true,
      headers: guestSessionHeaders(accessToken),
    }),
};
