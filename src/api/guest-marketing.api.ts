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
  get: (accessToken: string, bookingCode: string) =>
    ApiClient.get<GuestMarketing>(marketingPath(bookingCode), undefined, {
      public: true,
      headers: guestSessionHeaders(accessToken),
    }),

  save: (accessToken: string, bookingCode: string, change: GuestMarketingChange) =>
    ApiClient.put<GuestMarketing>(marketingPath(bookingCode), change, {
      public: true,
      headers: guestSessionHeaders(accessToken),
    }),

  resendConfirmation: (accessToken: string, bookingCode: string) =>
    ApiClient.post<GuestMarketingResend>(`${marketingPath(bookingCode)}/resend-confirmation`, undefined, {
      public: true,
      headers: guestSessionHeaders(accessToken),
    }),
};
