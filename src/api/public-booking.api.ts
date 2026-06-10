import { ApiClient } from './client';
import type { CreateDirectBookingPayload, DirectBookingResponse } from '@/types';

export const publicBookingApi = {
  createDirectBooking: (payload: CreateDirectBookingPayload) =>
    ApiClient.post<DirectBookingResponse>('/public/bookings', payload),
};
