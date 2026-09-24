import { ApiClient } from './client';
import type {
  CreateDirectBookingPayload,
  DirectBookingResponse,
  GuestBookingLookupResponse,
  BookingStatusResponse,
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

  /** The guest confirms the email of a "pay at the property" request with the token of the link (BK-06). */
  confirmOnSiteRequestEmail: (bookingId: string, token: string) =>
    ApiClient.post<OnSiteRequestConfirmation>(
      `/public/bookings/${bookingId}/confirm-email`,
      { token },
      { public: true },
    ),
};
