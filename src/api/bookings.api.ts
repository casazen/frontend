import { ApiClient } from './client';
import type {
  Booking,
  BookingApprovalRequest,
  BookingCancellationQuote,
  CancelBookingDto,
  CancelBookingResult,
  CreateBookingDto,
  UpdateBookingDto,
  ArrivalRegisteredBooking,
  HostBookingQuotePayload,
  DeclineBookingRequestDto,
} from '@/types';
import type { DirectBookingQuote } from '@/types/direct-booking.types';
import type { CalendarResponseDto } from '@/types/calendar.types';
import type { CheckInLinkResponse, CheckInSessionStatusDto } from '@/types/public-checkin.types';

export const bookingsApi = {
  getAll: (params?: Record<string, unknown>) =>
    ApiClient.get<Booking[]>('/bookings', params),

  getByGuestId: (guestId: string) =>
    ApiClient.get<Booking[]>('/bookings', { guestId }),

  getById: (id: string) => ApiClient.get<Booking>(`/bookings/${id}`),

  create: (data: CreateBookingDto) =>
    ApiClient.post<Booking>('/bookings', data),

  /** Dates, guests and notes only: the backend computes the price again (PC-07). */
  update: (id: string, data: UpdateBookingDto) =>
    ApiClient.put<Booking>(`/bookings/${id}`, data),

  /** Price of a stay the host is entering or changing, tourist tax included (PC-07, BK-03). */
  quote: (payload: HostBookingQuotePayload) => ApiClient.post<DirectBookingQuote>('/bookings/quote', payload),

  /** What cancelling now would do: paid, refundable and minimum refund amounts (BK-02). */
  getCancellationQuote: (id: string) =>
    ApiClient.get<BookingCancellationQuote>(`/bookings/${id}/cancellation`),

  /** Cancels the booking: unpaid intents canceled on Stripe, `refundAmount` refunded (BK-02). */
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
};
