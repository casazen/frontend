import { ApiClient } from './client';
import type {
  CreateDirectBookingPayload,
  DirectBookingQuote,
  DirectBookingQuotePayload,
  DirectBookingResponse,
  GuestBookingLookupResponse,
  BookingStatusResponse,
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

  getBookingStatus: (bookingId: string) =>
    ApiClient.get<BookingStatusResponse>(`/public/bookings/${bookingId}/status`, undefined, { public: true }),
};
