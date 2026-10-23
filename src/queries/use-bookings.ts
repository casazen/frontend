import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { asBookingPage, bookingsApi } from '@/api/bookings.api';
import type {
  Booking,
  BookingFilterParams,
  BookingListParams,
  CancelBookingDto,
  CreateManualBookingDto,
  StayAvailabilityParams,
  UpdateBookingDto,
  HostBookingQuotePayload,
  DeclineBookingRequestDto,
  CreateOtaStayDto,
  ResolveOtaReviewDto,
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
    queryFn: async () => asBookingPage(await bookingsApi.getAll({ pageSize: 10, ...params })),
  });
}

/** The bookings of one property (same cache entry as `useBookings({ propertyId })`); nothing without a property. */
export function usePropertyBookings(propertyId?: string) {
  return useQuery({
    queryKey: [BOOKINGS_KEY, { propertyId }],
    queryFn: async () => asBookingPage(await bookingsApi.getAll({ propertyId, page: 1, pageSize: 100 })).items,
    enabled: !!propertyId,
  });
}

/**
 * One page of the list of bookings (SR-04): the server narrows it by chip, filters and text, orders it and pages it. The rows
 * of the last view stay on the screen until the next ones arrive. Other screens change the bookings (made, accepted, cancelled
 * there), so the list reads again when it is opened: the client does not, by default (`refetchOnMount: false`).
 */
export function useBookingList(params: BookingListParams, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: [BOOKINGS_KEY, 'list', params],
    queryFn: () => bookingsApi.search(params),
    placeholderData: keepPreviousData,
    refetchOnMount: true,
    enabled: options.enabled ?? true,
  });
}

/** How many bookings are in each chip of the list, for the filters in force (the number on "Da confermare"). */
export function useBookingCounts(params: BookingFilterParams, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: [BOOKINGS_KEY, 'counts', params],
    queryFn: () => bookingsApi.counts(params),
    placeholderData: keepPreviousData,
    refetchOnMount: true,
    enabled: options.enabled ?? true,
  });
}

export function useBooking(id: string) {
  return useQuery({
    queryKey: [BOOKINGS_KEY, id],
    queryFn: () => bookingsApi.getById(id),
    enabled: !!id,
  });
}

/**
 * The history of a booking (SR-05c): the sheet and the drawer show it. Almost every action on the booking (and on its check-in
 * link, its payments, its Alloggiati communication) adds an entry, and the client does not read an unobserved query again by
 * default (`refetchOnMount: false`), so it reads again whenever the history is opened.
 */
export function useBookingTimeline(id: string) {
  return useQuery({
    queryKey: [BOOKINGS_KEY, id, 'timeline'],
    queryFn: () => bookingsApi.getTimeline(id),
    enabled: !!id,
    refetchOnMount: 'always',
  });
}

/**
 * "Pay at the property" requests waiting for the host's answer (BK-06, decision D5). Also the counter of "Prenotazioni"
 * in the menu (UI-04a), which shares the cache with the requests panel and reads it only when `enabled`.
 */
export function useBookingApprovalRequests(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: [BOOKINGS_KEY, 'approval-requests'],
    queryFn: () => bookingsApi.getApprovalRequests(),
    retry: retryTransientErrors(1),
    enabled: options?.enabled ?? true,
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

/**
 * Creates a booking entered by hand with only the name and the email of the guest (SR-06a), or completes a portal's block. No
 * error toast: the wizard of the new booking shows the error above its buttons (e.g. 409 on overlapping dates). Every list of
 * bookings, and every answer of the availability, is read again.
 */
export function useCreateManualBooking() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateManualBookingDto) => bookingsApi.createManual(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [BOOKINGS_KEY] });
      toast.success(i18n.t('toast.bookingCreated'));
    },
  });
}

const stayAvailabilityKey = (params: StayAvailabilityParams | null) => [BOOKINGS_KEY, 'availability', params] as const;

/**
 * Whether the stay is free (SR-06a), said as soon as the property and the dates are known. It is advice for the host: when the
 * answer cannot be had the wizard goes on without it, and the API checks again when the booking is created.
 */
export function useStayAvailability(params: StayAvailabilityParams | null) {
  return useQuery({
    queryKey: stayAvailabilityKey(params),
    queryFn: () => bookingsApi.availability(params!),
    enabled: params !== null,
    staleTime: 15_000,
    retry: false,
  });
}

/** The same answer, asked afresh from an event handler (the wizard checks it before it leaves the stay): never the one on screen. */
export function fetchStayAvailability(queryClient: QueryClient, params: StayAvailabilityParams) {
  return queryClient.fetchQuery({
    queryKey: stayAvailabilityKey(params),
    queryFn: () => bookingsApi.availability(params),
    staleTime: 0,
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

const hostBookingQuoteKey = (payload: HostBookingQuotePayload | null) => [BOOKINGS_KEY, 'quote', payload] as const;

/**
 * Price of the stay in the host form, tourist tax included (BK-03): it also says whether the ages of the minors
 * matter (`touristTax.ageRulesApply`).
 */
export function useHostBookingQuote(payload: HostBookingQuotePayload | null) {
  return useQuery({
    queryKey: hostBookingQuoteKey(payload),
    queryFn: () => bookingsApi.quote(payload!),
    enabled: payload !== null,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    retry: false,
  });
}

/**
 * The same quote, asked once from an event handler (the wizard of the new booking checks it before it moves on): it uses
 * and fills the cache of `useHostBookingQuote`. A refusal of the API (too many guests, dates out of range) is thrown.
 */
export function fetchHostBookingQuote(queryClient: QueryClient, payload: HostBookingQuotePayload) {
  return queryClient.fetchQuery({
    queryKey: hostBookingQuoteKey(payload),
    queryFn: () => bookingsApi.quote(payload),
    staleTime: 30_000,
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

/**
 * "Registra arrivo" (CO-08, A5-08). No toast: the dialog shows the error and, on success, whether the guest data for
 * Alloggiati still have to be completed. The Alloggiati status and the compliance cockpit change with the arrival.
 */
export function useCheckIn() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => bookingsApi.checkIn(id),
    onSuccess: (booking) => {
      applyBookingChange(queryClient, booking);
      queryClient.invalidateQueries({ queryKey: ['alloggiati'] });
      queryClient.invalidateQueries({ queryKey: ['compliance'] });
    },
  });
}

/**
 * "Crea soggiorno OTA" from an iCal block (CO-21). No error toast: the form shows the error next to the fields (e.g. 409
 * when the block is already a stay or overlaps a booking). The calendar and the booking lists change.
 */
export function useCreateOtaStay() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ blockId, data }: { blockId: string; data: CreateOtaStayDto }) => bookingsApi.createOtaStay(blockId, data),
    onSuccess: (booking) => {
      applyBookingChange(queryClient, booking);
      queryClient.invalidateQueries({ queryKey: ['compliance'] });
      toast.success(i18n.t('booking.otaStay.created'));
    },
  });
}

/** "Segna come verificato" of an OTA stay (CO-21). No error toast: the notice shows the error. */
export function useResolveOtaReview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data?: ResolveOtaReviewDto }) => bookingsApi.resolveOtaReview(id, data),
    onSuccess: (booking) => {
      applyBookingChange(queryClient, booking);
      toast.success(i18n.t('booking.otaReview.resolved'));
    },
  });
}
