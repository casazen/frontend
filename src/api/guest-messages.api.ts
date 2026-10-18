import { ApiClient } from './client';
import { guestSessionHeaders } from './guest-session.api';
import type { GuestThread, SentGuestMessage } from '@/types';

function messagesPath(bookingCode: string): string {
  return `/public/guest/bookings/${encodeURIComponent(bookingCode)}/messages`;
}

/**
 * The messages between the guest and the host (DB-14a), in the guest area: the calls are anonymous for the hosts' sign-in and carry the
 * token of the guest session. Never the text in a URL or a log: the text goes in the body.
 */
export const guestMessagesApi = {
  /**
   * The thread of the booking, oldest message first. 401 when the session is no longer good; 404 `guest_booking_not_found` when the
   * booking has no thread (cancelled, not confirmed) or is not the guest's; 429 `rate_limited`.
   */
  getThread: (accessToken: string, bookingCode: string) =>
    ApiClient.get<GuestThread>(messagesPath(bookingCode), undefined, {
      public: true,
      headers: guestSessionHeaders(accessToken),
    }),

  /**
   * A message to the host. `idempotencyKey` is made once per message: sending it again with the same key never writes it twice.
   * 409 `thread_closed`, 422 `guest_message_text_invalid`, 429 `rate_limited` with `retryAfterSeconds`.
   */
  send: (accessToken: string, bookingCode: string, text: string, idempotencyKey: string) =>
    ApiClient.post<SentGuestMessage>(
      messagesPath(bookingCode),
      { text },
      { public: true, headers: { ...guestSessionHeaders(accessToken), 'Idempotency-Key': idempotencyKey } },
    ),
};
