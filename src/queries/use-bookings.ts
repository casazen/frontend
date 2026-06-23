import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { bookingsApi } from '@/api/bookings.api';
import type {
  CreateBookingDto,
  UpdateBookingDto,
  CheckInDto,
  CheckOutDto,
} from '@/types';
import { toast } from 'sonner';
import i18n from '@/i18n/config';

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
      toast.success(i18n.t('toast.bookingCreated'));
    },
    onError: () => {
      toast.error(i18n.t('toast.bookingCreateFailed'));
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
      toast.success(i18n.t('toast.bookingUpdated'));
    },
    onError: () => {
      toast.error(i18n.t('toast.bookingUpdateFailed'));
    },
  });
}

export function useDeleteBooking() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => bookingsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [BOOKINGS_KEY] });
      toast.success(i18n.t('toast.bookingDeleted'));
    },
    onError: () => {
      toast.error(i18n.t('toast.bookingDeleteFailed'));
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
      toast.success(i18n.t('toast.guestCheckedIn'));
    },
    onError: () => {
      toast.error(i18n.t('toast.checkInGuestFailed'));
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
      toast.success(i18n.t('toast.guestCheckedOut'));
    },
    onError: () => {
      toast.error(i18n.t('toast.checkOutGuestFailed'));
    },
  });
}
