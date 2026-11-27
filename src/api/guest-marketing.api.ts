import { ApiClient } from './client';
import { guestSessionHeaders } from './guest-session.api';
import type { GuestMarketing, GuestMarketingChange, GuestMarketingResend } from '@/types/guest-marketing.types';

function marketingPath(bookingCode: string): string {
  return `/public/guest/bookings/${encodeURIComponent(bookingCode)}/marketing`;
}

/**
 * The marketing choices of the guest of a booking, in the guest area (E07/F04/US01/T04, NF-90, CRM-03): the calls are anonymous for the hosts'
 * sign-in and carry the token of the guest session. Never an address or a number in a URL or a log: they go in the body. Not behind the CRM
 * flag on the server: a legal record is made whatever the flag says.
 */
export const guestMarketingApi = {
  /**
   * The choices of the guest, per channel, with the values masked. 401 when the session is no longer good; 404 `guest_booking_not_found` when the
   * booking is not the guest's; 429 `rate_limited`.
   */
  get: (accessToken: string, bookingCode: string) =>
    ApiClient.get<GuestMarketing>(marketingPath(bookingCode), undefined, {
      public: true,
      headers: guestSessionHeaders(accessToken),
    }),

  /**
   * Changes the choices and answers them as they are then. 400 `validation_error` for a channel that does not say `enabled`; 409
   * `guest_marketing_consent_outdated` (the version sent is not the current one); 422 `guest_marketing_consent_unavailable`,
   * `guest_marketing_email_invalid`, `guest_marketing_phone_invalid`; 429.
   */
  save: (accessToken: string, bookingCode: string, change: GuestMarketingChange) =>
    ApiClient.put<GuestMarketing>(marketingPath(bookingCode), change, {
      public: true,
      headers: guestSessionHeaders(accessToken),
    }),

  /** Asks for the confirmation e-mail of the pending e-mail consent again, within the limits of the confirmation. 503 `marketing_confirmation_unavailable`; 429. */
  resendConfirmation: (accessToken: string, bookingCode: string) =>
    ApiClient.post<GuestMarketingResend>(`${marketingPath(bookingCode)}/resend-confirmation`, undefined, {
      public: true,
      headers: guestSessionHeaders(accessToken),
    }),
};
