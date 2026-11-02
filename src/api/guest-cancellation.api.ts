import { ApiClient } from './client';
import { guestSessionHeaders } from './guest-session.api';
import type { GuestCancelResult, GuestCancellationPreview, GuestLinkCancelResult } from '@/types';

function areaPath(bookingCode: string): string {
  return `/public/guest/bookings/${encodeURIComponent(bookingCode)}`;
}

function linkPath(bookingId: string): string {
  return `/public/bookings/${encodeURIComponent(bookingId)}`;
}

/**
 * The cancellation of the guest (DB-08a, DB-08b), from the guest area (the token of the guest session) or from the page of the link the
 * host sent (the signed token of the link, in the query string as the backend wants it). The calls are anonymous for the hosts' sign-in.
 * The amounts are the backend's: `expectedRefundAmount` is the `refundAmount` the guest was shown, never one worked out here.
 */
export const guestCancellationApi = {
  /** What cancelling would do now. 401 when the session is no longer good; 404 `guest_booking_not_found`; 429 `rate_limited`. */
  getPreview: (accessToken: string, bookingCode: string) =>
    ApiClient.get<GuestCancellationPreview>(`${areaPath(bookingCode)}/cancellation`, undefined, {
      public: true,
      headers: guestSessionHeaders(accessToken),
    }),

  /**
   * Cancels for the refund the guest was shown. `idempotencyKey` is made once per confirmation: the same key again answers the same.
   * 409 `refund_changed` (nothing cancelled; the problem carries the new `preview`), 409 `booking_payment_in_progress`, 422
   * `guest_cancel_stay_started` / `booking_not_cancellable_by_guest`, 429 `rate_limited` with `retryAfterSeconds`.
   */
  cancel: (accessToken: string, bookingCode: string, expectedRefundAmount: number, idempotencyKey: string) =>
    ApiClient.post<GuestCancelResult>(
      `${areaPath(bookingCode)}/cancel`,
      { confirm: true, expectedRefundAmount },
      { public: true, headers: { ...guestSessionHeaders(accessToken), 'Idempotency-Key': idempotencyKey } },
    ),

  /** The same preview for the page of the host's link; the token is not spent. 422 `guest_cancel_token_invalid` / `_expired`. */
  getLinkPreview: (bookingId: string, token: string) =>
    ApiClient.get<GuestCancellationPreview>(`${linkPath(bookingId)}/cancellation?token=${encodeURIComponent(token)}`, undefined, {
      public: true,
    }),

  /** Cancels with the host's link for the refund the page showed. 409 `refund_changed` leaves the link usable. */
  cancelWithLink: (bookingId: string, token: string, expectedRefundAmount: number) =>
    ApiClient.post<GuestLinkCancelResult>(
      `${linkPath(bookingId)}/cancel?token=${encodeURIComponent(token)}`,
      { expectedRefundAmount },
      { public: true },
    ),
};
