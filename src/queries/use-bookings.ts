import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { bookingsApi } from '@/api/bookings.api';
import type {
  Booking,
  CancelBookingDto,
  CreateBookingDto,
  UpdateBookingDto,
  CheckInDto,
  HostBookingQuotePayload,
  DeclineBookingRequestDto,
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

/** "Pay at the property" requests waiting for the host's answer (BK-06, decision D5). */
export function useBookingApprovalRequests() {
  return useQuery({
    queryKey: [BOOKINGS_KEY, 'approval-requests'],
    queryFn: () => bookingsApi.getApprovalRequests(),
    retry: retryTransientErrors(1),
  });
}

/** Accepts a "pay at the property" request: the booking becomes Confirmed. */
export function useApproveBookingRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => bookingsApi.approveRequest(id),
    onSuccess: () => {
      toast.success(i18n.t('booking.requests.approved'));
    },
    onError: (error) => {
      toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('booking.requests.approveFailed'));
    },
    // Also after a 409 (answered elsewhere, expired): the list shows the current state.
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: [BOOKINGS_KEY] });
    },
  });
}

/** Declines a "pay at the property" request: cancelled, dates released, guest emailed. */
export function useDeclineBookingRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: DeclineBookingRequestDto }) => bookingsApi.declineRequest(id, data),
    onSuccess: () => {
      toast.success(i18n.t('booking.requests.declined'));
    },
    onError: (error) => {
      toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('booking.requests.declineFailed'));
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: [BOOKINGS_KEY] });
    },
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

/** Stores the booking returned by an action and refreshes every booking list. */
function applyBookingChange(queryClient: QueryClient, booking: Booking) {
  queryClient.setQueryData([BOOKINGS_KEY, booking.id], booking);
  queryClient.invalidateQueries({ queryKey: [BOOKINGS_KEY] });
}

/**
 * Changes dates, guests and notes (PC-07). No error toast: the edit form shows the error next to the fields (e.g. 409
 * on overlapping dates).
 */
export function useUpdateBooking() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateBookingDto }) =>
      bookingsApi.update(id, data),
    onSuccess: (booking) => {
      applyBookingChange(queryClient, booking);
      toast.success(i18n.t('toast.bookingUpdated'));
    },
  });
}

/**
 * Confirmation of a pending booking from its detail page (PC-07): same endpoint as the requests panel of BK-06
 * (`approveRequest`), without the error toast because the dialog shows the error.
 */
export function useConfirmBooking() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => bookingsApi.approveRequest(id),
    onSuccess: (booking) => {
      applyBookingChange(queryClient, booking);
      toast.success(i18n.t('booking.confirm.success'));
    },
  });
}

/**
 * Price of the stay in the host form, tourist tax included (BK-03): it also says whether the ages of the minors
 * matter (`touristTax.ageRulesApply`).
 */
export function useHostBookingQuote(payload: HostBookingQuotePayload | null) {
  return useQuery({
    queryKey: [BOOKINGS_KEY, 'quote', payload],
    queryFn: () => bookingsApi.quote(payload!),
    enabled: payload !== null,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    retry: false,
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
