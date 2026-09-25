import { ApiClient } from './client';
import type {
  CreateDirectBookingPayload,
  DirectBookingQuote,
  DirectBookingQuotePayload,
  DirectBookingResponse,
  GuestBookingDetails,
  GuestBookingLookupPayload,
  CheckoutOutcome,
  CheckoutPaymentSession,
  OnSiteRequestConfirmation,
} from '@/types';

export interface PropertyAvailability {
  propertyId: string;
  /** First night of the range (included). */
  startDate: string;
  /** End of the range (excluded). */
  endDate: string;
  /** Taken nights (`YYYY-MM-DD`), in order; a taken night can still be a check-out day. */
  bookedDates: string[];
}

export const publicBookingApi = {
  createDirectBooking: (payload: CreateDirectBookingPayload) =>
    ApiClient.post<DirectBookingResponse>('/public/bookings', payload, { public: true }),

  /** Price of the stay computed by the backend, tourist tax included (BK-03): the amounts the booking records. */
  quoteDirectBooking: (payload: DirectBookingQuotePayload) =>
    ApiClient.post<DirectBookingQuote>('/public/bookings/quote', payload, { public: true }),

  /**
   * Nights already taken on the booking site (BK-05): bookings, checkout holds, "pay at the property" requests and iCal or
   * manual blocks, by the same rule the checkout applies. Takes the property **id** (never the slug of the page URL);
   * 404 `public_property_not_found` when the property is not published. Without dates: one year from today.
   */
  getPropertyAvailability: (propertyId: string, startDate?: string, endDate?: string) =>
    ApiClient.get<PropertyAvailability>(
      `/public/bookings/property/${encodeURIComponent(propertyId)}/availability`,
      { startDate, endDate },
      { public: true },
    ),

  /**
   * "Le mie prenotazioni" (BK-11): the booking of this site with its code and the guest's email, in the body (never in the
   * URL). 404 `guest_booking_not_found` whatever does not match; 429 `rate_limited`.
   */
  lookupGuestBooking: (payload: GuestBookingLookupPayload) =>
    ApiClient.post<GuestBookingDetails>('/public/bookings/lookup', payload, { public: true }),

  /** Emails the online check-in link again to the address of the booking (202); 409 `guest_check_in_link_unavailable`. */
  sendGuestCheckInLink: (payload: GuestBookingLookupPayload) =>
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
