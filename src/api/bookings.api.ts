import { ApiClient } from './client';
import type {
  Booking,
  BookingApprovalRequest,
  BookingCancellationQuote,
  CancelBookingDto,
  CancelBookingResult,
  CreateBookingDto,
  UpdateBookingDto,
  CheckInDto,
  CheckOutDto,
  DeclineBookingRequestDto,
} from '@/types';
import type { CalendarResponseDto } from '@/types/calendar.types';
import type { CheckInSessionStatusDto, ResendCheckInLinkResponse } from '@/types/public-checkin.types';

export const bookingsApi = {
  getAll: (params?: Record<string, unknown>) =>
    ApiClient.get<Booking[]>('/bookings', params),

  getByGuestId: (guestId: string) =>
    ApiClient.get<Booking[]>('/bookings', { guestId }),

  getById: (id: string) => ApiClient.get<Booking>(`/bookings/${id}`),

  create: (data: CreateBookingDto) =>
    ApiClient.post<Booking>('/bookings', data),

  update: (id: string, data: UpdateBookingDto) =>
    ApiClient.put<Booking>(`/bookings/${id}`, data),

  /** What cancelling now would do: paid, refundable and minimum refund amounts (BK-02). */
  getCancellationQuote: (id: string) =>
    ApiClient.get<BookingCancellationQuote>(`/bookings/${id}/cancellation`),

  /** Cancels the booking: unpaid intents canceled on Stripe, `refundAmount` refunded (BK-02). */
  cancel: (id: string, data: CancelBookingDto = {}) =>
    ApiClient.post<CancelBookingResult>(`/bookings/${id}/cancel`, data),

  /** "Pay at the property" requests waiting for the host's answer (BK-06). */
  getApprovalRequests: () => ApiClient.get<BookingApprovalRequest[]>('/bookings/approval-requests'),

  /** Accepts a "pay at the property" request: the booking becomes Confirmed (BK-06). */
  approveRequest: (id: string) => ApiClient.post<Booking>(`/bookings/${id}/approve`),

  /** Declines a "pay at the property" request: cancelled, dates released; `message` goes to the guest (BK-06). */
  declineRequest: (id: string, data: DeclineBookingRequestDto = {}) =>
    ApiClient.post<Booking>(`/bookings/${id}/decline`, data),

  getCalendar: (params: { propertyId: string; startDate: string; endDate: string; timezone?: string }) =>
    ApiClient.get<CalendarResponseDto>('/bookings/calendar', params),

  checkIn: (id: string, data?: CheckInDto) =>
    ApiClient.post<Booking>(`/bookings/${id}/check-in`, data),

  checkOut: (id: string, data?: CheckOutDto) =>
    ApiClient.post<Booking>(`/bookings/${id}/check-out`, data),

  generateCheckInToken: (id: string) =>
    ApiClient.post<{ token: string }>(`/bookings/${id}/check-in-token`),

  getCheckInSession: (id: string) =>
    ApiClient.get<CheckInSessionStatusDto>(`/bookings/${id}/checkin-session`),

  resendCheckInLink: (id: string) =>
    ApiClient.post<ResendCheckInLinkResponse>(`/bookings/${id}/checkin/resend-link`),
};
