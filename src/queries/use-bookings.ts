import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { bookingsApi } from '@/api/bookings.api';
import type {
  CancelBookingDto,
  CreateBookingDto,
  UpdateBookingDto,
  CheckInDto,
  CheckOutDto,
} from '@/types';
import { toast } from 'sonner';
import i18n from '@/i18n/config';
import { getProblemMessage } from '@/lib/api-errors';
import { retryTransientErrors } from '@/lib/query-client';
import { PAYMENTS_KEY } from './use-payments';

const BOOKINGS_KEY = 'bookings';

export function useBookings(params?: Record<string, unknown>) {
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
    retry: retryTransientErrors(1),
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
    onError: (error) => {
      toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('toast.bookingCreateFailed'));
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
    onError: (error) => {
      toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('toast.bookingUpdateFailed'));
    },
  });
}

export function useBookingCancellationQuote(id: string, enabled = true) {
  return useQuery({
    queryKey: [BOOKINGS_KEY, id, 'cancellation'],
    queryFn: () => bookingsApi.getCancellationQuote(id),
    enabled: enabled && !!id,
    // Always the current amounts: a refund or a payment may have changed them meanwhile.
    staleTime: 0,
  });
}

/**
 * Cancels the booking with its money on Stripe (BK-02). No toast: the dialog shows the outcome of
 * each refund as Stripe left it, and the error.
 */
export function useCancelBooking() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: CancelBookingDto }) => bookingsApi.cancel(id, data),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: [BOOKINGS_KEY] });
      queryClient.invalidateQueries({ queryKey: [PAYMENTS_KEY] });
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
    onError: (error) => {
      toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('toast.checkInGuestFailed'));
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
    onError: (error) => {
      toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('toast.checkOutGuestFailed'));
    },
  });
}
