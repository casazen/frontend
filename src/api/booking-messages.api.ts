import { ApiClient } from './client';
import type { HostThread, HostThreadSummary, SentGuestMessage } from '@/types';

/** A page of `GET /api/messages`. */
export interface HostThreadPage {
  items: HostThreadSummary[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export interface HostThreadFilters {
  /** True keeps the open threads whose last message is the guest's (the «Da rispondere» of the Home). */
  needsReply?: boolean;
  propertyId?: string;
  page?: number;
  pageSize?: number;
}

function messagesPath(bookingId: string): string {
  return `/bookings/${encodeURIComponent(bookingId)}/messages`;
}

/**
 * The host's side of the messages with the guest (DB-14a, SR-12), on the booking: `booking.read` to read, `booking.write` to answer and
 * to mark as read; a booking the host does not reach answers 404. The text of the messages is the guest's personal data: it goes in the
 * body, never in an address, and the answers are not kept anywhere but in the memory of the page.
 */
export const bookingMessagesApi = {
  /** The thread of the booking: messages oldest first, `unreadCount`, `needsReply`; `state` `Unavailable` when the booking has none. */
  getThread: (bookingId: string) => ApiClient.get<HostThread>(messagesPath(bookingId)),

  /**
   * The host's message to the guest (also the first one). `idempotencyKey` is made once per message: the same key again never writes it
   * twice. 409 `thread_closed`, 422 `guest_message_text_invalid`, 429 `rate_limited`.
   */
  send: (bookingId: string, text: string, idempotencyKey: string) =>
    ApiClient.post<SentGuestMessage>(messagesPath(bookingId), { text }, { headers: { 'Idempotency-Key': idempotencyKey } }),

  /** Marks the guest's messages as read (up to the last one) and answers the thread as it is after. */
  markRead: (bookingId: string) => ApiClient.post<HostThread>(`${messagesPath(bookingId)}/read`),

  /** The threads of the host's properties, the latest message first. */
  listThreads: (filters: HostThreadFilters = {}) => ApiClient.get<HostThreadPage>('/messages', filters),
};
