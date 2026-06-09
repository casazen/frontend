import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { bookingsApi } from '@/api/bookings.api';
import type {
  CreateBookingDto,
  UpdateBookingDto,
  CheckInDto,
  CheckOutDto,
} from '@/types';
import { toast } from 'sonner';

const BOOKINGS_KEY = 'bookings';

export function useBookings(params?: Record<string, any>) {
  return useQuery({
    queryKey: [BOOKINGS_KEY, params],
    queryFn: () => bookingsApi.getAll(params),
  });
}

export function useBooking(id: string) {
  return useQuery({
    queryKey: [BOOKINGS_KEY, id],
    queryFn: () => bookingsApi.getById(id),
    enabled: !!id,
  });
}

export function useBookingCalendar(params?: {
  propertyId: string;
  startDate: string;
  endDate: string;
  timezone?: string;
}) {
  return useQuery({
    queryKey: [BOOKINGS_KEY, 'calendar', params],
    queryFn: () => bookingsApi.getCalendar(params!),
    enabled: !!params?.propertyId && !!params?.startDate && !!params?.endDate,
    retry: 1,
  });
}

export function useCreateBooking() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateBookingDto) => bookingsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [BOOKINGS_KEY] });
      toast.success('Booking created successfully');
    },
    onError: () => {
      toast.error('Failed to create booking');
    },
  });
}

export function useUpdateBooking() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateBookingDto }) =>
      bookingsApi.update(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [BOOKINGS_KEY] });
      queryClient.invalidateQueries({ queryKey: [BOOKINGS_KEY, variables.id] });
      toast.success('Booking updated successfully');
    },
    onError: () => {
      toast.error('Failed to update booking');
    },
  });
}

export function useDeleteBooking() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => bookingsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [BOOKINGS_KEY] });
      toast.success('Booking deleted successfully');
    },
    onError: () => {
      toast.error('Failed to delete booking');
    },
  });
}

export function useCheckIn() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data?: CheckInDto }) =>
      bookingsApi.checkIn(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [BOOKINGS_KEY] });
      queryClient.invalidateQueries({ queryKey: [BOOKINGS_KEY, variables.id] });
      toast.success('Guest checked in successfully');
    },
    onError: () => {
      toast.error('Failed to check in guest');
    },
  });
}

export function useCheckOut() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data?: CheckOutDto }) =>
      bookingsApi.checkOut(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [BOOKINGS_KEY] });
      queryClient.invalidateQueries({ queryKey: [BOOKINGS_KEY, variables.id] });
      toast.success('Guest checked out successfully');
    },
    onError: () => {
      toast.error('Failed to check out guest');
    },
  });
}
