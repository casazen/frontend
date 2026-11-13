import { ApiClient } from './client';
import type {
  Booking,
  BookingApprovalRequest,
  BookingCancellationQuote,
  BookingCounts,
  BookingEditQuote,
  BookingFilterParams,
  BookingListItem,
  BookingListParams,
  BookingPaymentLink,
  BookingTimeline,
  CancelBookingDto,
  CancelBookingResult,
  CreateBookingDto,
  CreateManualBookingDto,
  ManualBooking,
  OctorateSyncRetryResult,
  StayAvailability,
  StayAvailabilityParams,
  UpdateBookingDto,
  UpdatedBooking,
  ArrivalRegisteredBooking,
  HostBookingQuotePayload,
  DeclineBookingRequestDto,
  CreateOtaStayDto,
  ResolveOtaReviewDto,
} from '@/types';
import type { DirectBookingQuote } from '@/types/direct-booking.types';
import type { CalendarResponseDto } from '@/types/calendar.types';
import type { CheckInLinkResponse, CheckInSessionStatusDto } from '@/types/public-checkin.types';
import type { PagedResult } from '@/types/users.types';

/** Backend `PagedResultDto` or a legacy array from older mocks. */
export function asBookingPage(data: PagedResult<Booking> | Booking[] | undefined): PagedResult<Booking> {
  if (!data) return { items: [], totalCount: 0, page: 1, pageSize: 10 };
  if (Array.isArray(data)) return { items: data, totalCount: data.length, page: 1, pageSize: data.length || 10 };
  return {
    items: data.items ?? [],
    totalCount: data.totalCount ?? 0,
    page: data.page ?? 1,
    pageSize: data.pageSize ?? 10,
  };
}

export const bookingsApi = {
  getAll: (params?: Record<string, unknown>) =>
    ApiClient.get<PagedResult<Booking> | Booking[]>('/bookings', params),

  getByGuestId: (guestId: string) =>
    ApiClient.get<PagedResult<Booking> | Booking[]>('/bookings', { guestId }),

  /** One page of the list of bookings: the server narrows it by chip, filters and text, orders it and pages it (SR-03b). */
  search: (params: BookingListParams) => ApiClient.get<PagedResult<BookingListItem>>('/bookings/search', params),

  /** How many bookings are in each chip of the list, for the same filters (SR-03b). */
  counts: (params: BookingFilterParams) => ApiClient.get<BookingCounts>('/bookings/counts', params),

  getById: (id: string) => ApiClient.get<Booking>(`/bookings/${id}`),

  /** What happened to a booking and what it waits for, in order (SR-05a); the amounts only for who may read payments. */
  getTimeline: (id: string) => ApiClient.get<BookingTimeline>(`/bookings/${id}/timeline`),

  /** The older creation of a booking by hand, which asks for the whole contact of the guest; the new booking page uses `createManual`. */
  create: (data: CreateBookingDto) =>
    ApiClient.post<Booking>('/bookings', data),

  /**
   * A booking entered by hand with only the name and the email of the guest, at the price of the quote or at the one the host
   * agreed, or the completion of a portal's block (SR-06a).
   */
  createManual: (data: CreateManualBookingDto) => ApiClient.post<ManualBooking>('/bookings/manual', data),

  /**
   * A new payment link of the balance of a booking the host entered, e-mailed to the guest (NF-74, E08/F01/US01/T05): the previous link stops working. The
   * answer gives the link once, for the host to copy; the token in it is never stored by the API. Needs `payment.write`; 422 `payment_link_unavailable` when
   * the booking is not one the host entered, is cancelled, has nothing left to pay or a payment in progress, or the Stripe account is not ready; 503
   * `payment_provider_error` when Stripe did not answer.
   */
  createPaymentLink: (id: string) => ApiClient.post<BookingPaymentLink>(`/bookings/${id}/payment-link`),

  /**
   * Whether a stay of a property is free, what takes it if not and the nearest free dates (SR-06a); for a property mirrored on the channel manager its answer
   * is part of it (`channelManagerChecked`, a `channelManager` conflict, E08/F01/US02/T01). Advice: the API checks again on creation.
   */
  availability: ({ propertyId, from, to }: StayAvailabilityParams) =>
    ApiClient.get<StayAvailability>(`/properties/${encodeURIComponent(propertyId)}/availability`, { from, to }),

  /**
   * Asks again for the push of a booking to the channel manager (E08/F01/US01/T03, NF-74): only a sync that is `Failed` or `Conflict` (409
   * `octorate_sync_not_retryable` otherwise). 202: the push runs again through the event bus, and the sync keeps its state until it starts. `overwrite` is
   * the host's choice to write CasaZen's version over a reservation that changed there (a change, E08/F02): a creation has nothing to overwrite. Behind the
   * backend flag `Features:OctorateConnector`: 404 while it is off. 404 too for a booking of another org or out of the caller's reach.
   */
  retryOctorateSync: (id: string, overwrite = false) =>
    ApiClient.post<OctorateSyncRetryResult>(`/bookings/${id}/octorate-sync/retry${overwrite ? '?overwrite=true' : ''}`),

  /**
   * Dates, guests and notes only: the backend computes the price again (PC-07). For a confirmed booking of the booking site the money follows the price and the
   * answer says what was done with it (`settlement`, E08/F02/US01/T01, NF-75). 422 `booking_settlement_failed` when Stripe refuses: nothing is saved. 403
   * `booking_edit_payment_permission_required` when the money moves and the caller may not write payments.
   */
  update: (id: string, data: UpdateBookingDto) =>
    ApiClient.put<UpdatedBooking>(`/bookings/${id}`, data),

  /**
   * What `update` would do with the same body, worked out and not done: the new total, what the guest has paid and what happens to the difference (NF-75). The
   * same refusals as the edit (409 `booking_dates_unavailable`...). Needs `payment.read` on the property: 403 `booking_edit_payment_permission_required`.
   */
  editQuote: (id: string, data: UpdateBookingDto) =>
    ApiClient.post<BookingEditQuote>(`/bookings/${id}/edit-quote`, data),

  /** Price of a stay the host is entering or changing, tourist tax included (PC-07, BK-03). */
  quote: (payload: HostBookingQuotePayload) => ApiClient.post<DirectBookingQuote>('/bookings/quote', payload),

  /** What cancelling now would do: paid, refundable and minimum refund amounts (BK-02). */
  getCancellationQuote: (id: string) =>
    ApiClient.get<BookingCancellationQuote>(`/bookings/${id}/cancellation`),

  /**
   * Cancels the booking: unpaid intents canceled on Stripe, `refundAmount` refunded (BK-02). A booking that came from a channel takes the other path (E08/F02/US02/T02,
   * NF-76): the channel manager is asked first and the answer is 200 only after it confirmed, with no refund; 422 `ota_booking_cancel_not_allowed` where the
   * channel is closed, 422 `octorate_cancel_failed` when the channel manager refuses and 503 `octorate_unavailable` when it does not answer: the booking is
   * unchanged, and the problem carries `guidanceKey` and `channel`.
   */
  cancel: (id: string, data: CancelBookingDto = {}) =>
    ApiClient.post<CancelBookingResult>(`/bookings/${id}/cancel`, data),

  /** "Pay at the property" requests waiting for the host's answer (BK-06). */
  getApprovalRequests: () => ApiClient.get<BookingApprovalRequest[]>('/bookings/approval-requests'),

  /**
   * The host confirms a pending booking, the only confirmation of the console: accepts a "pay at the property" request
   * (BK-06) or confirms a pending booking entered by hand (PC-07). The booking becomes Confirmed.
   */
  approveRequest: (id: string) => ApiClient.post<Booking>(`/bookings/${id}/approve`),

  /** Declines a "pay at the property" request: cancelled, dates released; `message` goes to the guest (BK-06). */
  declineRequest: (id: string, data: DeclineBookingRequestDto = {}) =>
    ApiClient.post<Booking>(`/bookings/${id}/decline`, data),

  getCalendar: (params: { propertyId: string; startDate: string; endDate: string; timezone?: string }) =>
    ApiClient.get<CalendarResponseDto>('/bookings/calendar', params),

  /**
   * "Registra arrivo" (CO-08): a confirmed booking becomes checked in, from its check-in day to its check-out day
   * (Europe/Rome), late registrations included. Says whether the guest data for Alloggiati are complete.
   */
  checkIn: (id: string) => ApiClient.post<ArrivalRegisteredBooking>(`/bookings/${id}/check-in`),

  getCheckInSession: (id: string) =>
    ApiClient.get<CheckInSessionStatusDto>(`/bookings/${id}/checkin-session`),

  /** New check-in link to copy and send another way (no email); the previous link stops working. */
  createCheckInLink: (id: string) =>
    ApiClient.post<CheckInLinkResponse>(`/bookings/${id}/checkin/link`),

  /** New check-in link emailed to the guest (also the reminder); the link comes back whatever happens to the email. */
  resendCheckInLink: (id: string) =>
    ApiClient.post<CheckInLinkResponse>(`/bookings/${id}/checkin/resend-link`),

  /**
   * "Crea soggiorno OTA" (CO-21, decision D7): the iCal block becomes a confirmed stay with the source of its feed and
   * the guest given here; check-in link, Alloggiati and cockpit then work as for any stay.
   */
  createOtaStay: (blockId: string, data: CreateOtaStayDto) =>
    ApiClient.post<Booking>(`/ical-blocks/${blockId}/ota-stay`, data),

  /** "Segna come verificato" of an OTA stay "da verificare", optionally with the dates now on the channel (CO-21). */
  resolveOtaReview: (id: string, data: ResolveOtaReviewDto = {}) =>
    ApiClient.post<Booking>(`/bookings/${id}/ota-review/resolve`, data),
};
