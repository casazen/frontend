import { useMutation } from '@tanstack/react-query';
import { publicBookingApi } from '@/api/public-booking.api';
import type { CreateDirectBookingPayload } from '@/types';

export function useCreateDirectBooking() {
  return useMutation({
    mutationFn: (payload: CreateDirectBookingPayload) =>
      publicBookingApi.createDirectBooking(payload),
  });
}
