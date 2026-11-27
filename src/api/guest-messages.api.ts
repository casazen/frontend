import { ApiClient } from './client';
import { guestSessionHeaders } from './guest-session.api';
import type { GuestThread, SentGuestMessage } from '@/types';

function messagesPath(bookingCode: string): string {
  return `/public/guest/bookings/${encodeURIComponent(bookingCode)}/messages`;
}

export const guestMessagesApi = {
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
