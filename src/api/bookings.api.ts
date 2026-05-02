import { ApiClient } from './client';
import type {
  Booking,
  CreateBookingDto,
  UpdateBookingDto,
  CheckInDto,
  CheckOutDto,
} from '@/types';

export const bookingsApi = {
  getAll: (params?: Record<string, any>) =>
    ApiClient.get<Booking[]>('/bookings', params),

  getById: (id: string) => ApiClient.get<Booking>(`/bookings/${id}`),

  create: (data: CreateBookingDto) =>
    ApiClient.post<Booking>('/bookings', data),

  update: (id: string, data: UpdateBookingDto) =>
    ApiClient.put<Booking>(`/bookings/${id}`, data),

  delete: (id: string) => ApiClient.delete<void>(`/bookings/${id}`),

  getCalendar: (params?: { propertyId?: string; startDate?: string; endDate?: string }) =>
    ApiClient.get<Booking[]>('/bookings/calendar', params),

  checkIn: (id: string, data?: CheckInDto) =>
    ApiClient.post<Booking>(`/bookings/${id}/check-in`, data),

  checkOut: (id: string, data?: CheckOutDto) =>
    ApiClient.post<Booking>(`/bookings/${id}/check-out`, data),
};
