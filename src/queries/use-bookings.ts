import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { asBookingPage, bookingsApi } from '@/api/bookings.api';
import { ConnectApi } from '@/api/connect.api';
import type {
  Booking,
  BookingFilterParams,
  BookingListParams,
  BookingOctorateSync,
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
import { withoutRequest } from '@/features/marketplace/activation/use-sequential-run';
import i18n from '@/i18n/config';
import { getProblemMessage } from '@/lib/api-errors';
import { retryTransientErrors } from '@/lib/query-client';
import { resolveConnectUiStatus } from '@/types/connect.types';
import { CONNECT_STATUS_KEY } from './use-connect';
import { PAYMENTS_KEY } from './use-payments';

export const BOOKINGS_KEY = 'bookings';

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
 *
 * A mutation keeps what it was given (the name, the e-mail and the phone of the guest) and what it got back (the payment link, a credential: the token in it
 * is never stored by the API) in the mutation cache for five minutes by default, after the wizard is gone. Here it is dropped as soon as nothing
 * observes it (`gcTime: 0`), and a refusal is kept without the request that was sent (`withoutRequest`: the status and the body of the answer stay, which
 * is what a screen turns into words).
 */
export function useCreateManualBooking() {
  const queryClient = useQueryClient();

  return useMutation({
    gcTime: 0,
    mutationFn: async (data: CreateManualBookingDto) => {
      try {
        return await bookingsApi.createManual(data);
      } catch (error) {
        throw withoutRequest(error);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [BOOKINGS_KEY] });
      // A payment link starts a payment on the host's Stripe account: the payments are read again too.
      queryClient.invalidateQueries({ queryKey: [PAYMENTS_KEY] });
      toast.success(i18n.t('toast.bookingCreated'));
    },
  });
}

/**
 * A new payment link of the balance of a booking the host entered, e-mailed to the guest (NF-74): the result of the new-booking wizard sends it again from
 * there, or makes it when the creation could not. The link is a credential, so as for the creation the mutation is not kept (`gcTime: 0`) and a failure
 * keeps no request. No error toast: the result shows the error next to the link. The payments are read again (the link opens a payment).
 */
export function useCreatePaymentLink() {
  const queryClient = useQueryClient();

  return useMutation({
    gcTime: 0,
    mutationFn: async (id: string) => {
      try {
        return await bookingsApi.createPaymentLink(id);
      } catch (error) {
        throw withoutRequest(error);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: [PAYMENTS_KEY] });
    },
  });
}

/**
 * Asks again for the push of a booking to the channel manager (NF-74, NF-80): the result of the new-booking wizard offers it when the sync is `Failed` or
 * `Conflict`. No toast: the line of the channel manager shows the outcome and the error. Whatever the answer (a 409 "nothing to retry" included), the booking
 * is read again, so the line shows what the server holds.
 */
export function useRetryOctorateSync() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, overwrite }: { id: string; overwrite?: boolean }) => bookingsApi.retryOctorateSync(id, overwrite),
    onSettled: (_data, _error, { id }) => {
      void queryClient.invalidateQueries({ queryKey: [BOOKINGS_KEY, id] });
    },
  });
}

/**
 * Whether the organization's Stripe account is ready to take a payment (the payment link of the new-booking wizard, NF-74): `true` when it takes charges,
 * `false` when it is not connected or still being verified, `null` while that is not known (loading, or it could not be read: the link is then offered, and the API
 * checks again before it writes anything). The state as CasaZen holds it (`refresh=false`: no call to Stripe), read again whenever the wizard opens, because the
 * host may have just connected the account (the client does not read an unobserved query again by default). `enabled: false` reads nothing: the status needs
 * `payment.read`, and a read the caller may not make would send them to the page of no access.
 */
export function usePaymentLinkAccountReady(enabled: boolean): boolean | null {
  const query = useQuery({
    // Under the key of the status of the account, so that whoever changes the account (the page of the payments) makes this one stale too.
    queryKey: [...CONNECT_STATUS_KEY, 'new-booking'],
    queryFn: () => ConnectApi.getStatus(false),
    enabled,
    staleTime: 0,
    refetchOnMount: 'always',
    retry: false,
  });

  // An answer that is not a status is as good as none.
  return query.data && typeof query.data === 'object' ? resolveConnectUiStatus(query.data) === 'active' : null;
}

/** How often the result of the new-booking wizard asks the booking again while the channel manager has not answered. */
export const MIRROR_POLL_MS = 3_000;

/** What the read of the mirror keeps of a booking: the mirror and nothing else (the booking holds the contact of the guest, which the result does not need). */
export interface BookingMirror {
  octorateSync: BookingOctorateSync | null;
}

/** The key of the read of the mirror of a booking: an entry of its own, so that it is never the one the page of the booking opens on. */
export const bookingMirrorKey = (id: string) => [BOOKINGS_KEY, id, 'octorate-sync'] as const;

/**
 * The mirror of the booking the wizard has just created on the channel manager (`octorateSync`): only the detail of the booking carries it, not the answer of
 * the creation. The push to the channel manager runs after the booking is written (the event bus), so its state changes while the host looks at the result: the
 * query is read again whenever it is mounted (`refetchOnMount: 'always'`, which the client does not do by default) and every few seconds while `keepWatching`
 * says the answer is still to come. It keeps the mirror only, and not for long once the result is left (`gcTime: 0`): the booking page, which the host opens
 * from the result, reads the booking itself. `enabled: false` reads nothing (a property that is not connected, a connector that is off, a caller who may not read
 * the booking: a read they may not make would send them to the page of no access).
 */
export function useBookingMirror(id: string, options: { enabled: boolean; keepWatching: (mirror: BookingMirror | undefined) => boolean }) {
  const { enabled, keepWatching } = options;

  return useQuery({
    queryKey: bookingMirrorKey(id),
    queryFn: async (): Promise<BookingMirror> => {
      const booking = await bookingsApi.getById(id);
      return { octorateSync: booking.octorateSync ?? null };
    },
    enabled: !!id && enabled,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
    // No retry of its own: while the answer is still to come the next read is a few seconds away anyway, and a failure is said at once.
    retry: false,
    refetchInterval: (query) => (keepWatching(query.state.data) ? MIRROR_POLL_MS : false),
  });
}

const stayAvailabilityKey = (params: StayAvailabilityParams | null) => [BOOKINGS_KEY, 'availability', params] as const;

/**
 * Whether the stay is free (SR-06a), said as soon as the property and the dates are known. It is advice for the host: when the
 * answer cannot be had the wizard goes on without it, and the API checks again when the booking is created. Other screens change what takes the nights
 * (a booking made, a calendar that changed) and the client does not read an unobserved query again by default (`refetchOnMount: false`), so the answer
 * of an earlier visit is never the one shown: it is read again whenever the step opens.
 */
export function useStayAvailability(params: StayAvailabilityParams | null) {
  return useQuery({
    queryKey: stayAvailabilityKey(params),
    queryFn: () => bookingsApi.availability(params!),
    enabled: params !== null,
    staleTime: 15_000,
    refetchOnMount: 'always',
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
