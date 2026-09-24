import { ApiClient } from './client';
import type {
  CreateDirectBookingPayload,
  DirectBookingQuote,
  DirectBookingQuotePayload,
  DirectBookingResponse,
  GuestBookingLookupResponse,
  CheckoutOutcome,
  CheckoutPaymentSession,
  OnSiteRequestConfirmation,
} from '@/types';

export interface PropertyAvailability {
  propertyId: string;
  startDate: string;
  endDate: string;
  bookedDates: string[];
}

export const publicBookingApi = {
  createDirectBooking: (payload: CreateDirectBookingPayload) =>
    ApiClient.post<DirectBookingResponse>('/public/bookings', payload, { public: true }),

  /** Price of the stay computed by the backend, tourist tax included (BK-03): the amounts the booking records. */
  quoteDirectBooking: (payload: DirectBookingQuotePayload) =>
    ApiClient.post<DirectBookingQuote>('/public/bookings/quote', payload, { public: true }),

  getPropertyAvailability: (propertyId: string, startDate?: string, endDate?: string) => {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    const queryString = params.toString();
    return ApiClient.get<PropertyAvailability>(
      `/public/bookings/property/${propertyId}/availability${queryString ? `?${queryString}` : ''}`,
      undefined,
      { public: true },
    );
  },

  lookupGuestBookings: (email: string) =>
    ApiClient.post<GuestBookingLookupResponse>('/public/bookings/lookup', { email }, { public: true }),

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
