import { ApiClient } from './client';
import type { CreateDirectBookingPayload, DirectBookingResponse, GuestBookingLookupResponse, BookingStatusResponse } from '@/types';

export interface PropertyAvailability {
  propertyId: string;
  startDate: string;
  endDate: string;
  bookedDates: string[];
}

export const publicBookingApi = {
  createDirectBooking: (payload: CreateDirectBookingPayload) =>
    ApiClient.post<DirectBookingResponse>('/public/bookings', payload),

  getPropertyAvailability: (propertyId: string, startDate?: string, endDate?: string) => {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    const queryString = params.toString();
    return ApiClient.get<PropertyAvailability>(
      `/public/bookings/property/${propertyId}/availability${queryString ? `?${queryString}` : ''}`,
    );
  },

  lookupGuestBookings: (email: string) =>
    ApiClient.post<GuestBookingLookupResponse>('/public/bookings/lookup', { email }),

  getBookingStatus: (bookingId: string) =>
    ApiClient.get<BookingStatusResponse>(`/public/bookings/${bookingId}/status`),
};
