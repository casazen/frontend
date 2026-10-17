/** Longest message the backend takes (`GuestMessageRules.TextMaxLength`, DB-14a). */
export const GUEST_MESSAGE_MAX_LENGTH = 2000;

/** Who wrote a message of the thread between the guest of a direct booking and the host. */
export type GuestMessageSender = 'Guest' | 'Host';

/** One message: plain text (shown as text, never as markup or links). The guest's card numbers and IBANs arrive as «[rimosso]». */
export interface GuestThreadMessage {
  id: string;
  sender: GuestMessageSender;
  text: string;
  /** UTC instant. */
  createdAt: string;
}

/**
 * The thread of a booking as its guest reads it (`GET /api/public/guest/bookings/{code}/messages`, DB-14a): oldest message first,
 * readable also once it is `Closed` (the seventh day after the check-out has passed: new messages answer 409 `thread_closed`).
 */
export interface GuestThread {
  state: 'Open' | 'Closed';
  /** UTC instant from which the thread takes no more messages. */
  closesAt: string;
  messages: GuestThreadMessage[];
}

/**
 * The answer to a send. `redacted`: a card number or an IBAN of the text was replaced by «[rimosso]»; `replayed`: the same
 * `Idempotency-Key` had already written the message and nothing new was written.
 */
export interface SentGuestMessage {
  message: GuestThreadMessage;
  redacted: boolean;
  replayed: boolean;
}

/** `GET /api/bookings/{id}/messages` (DB-14a, SR-12): the thread as the host reads it. `Unavailable`: the booking has no thread. */
export interface HostThread {
  state: 'Open' | 'Closed' | 'Unavailable';
  /** UTC instant from which the thread takes no more messages; `null` when there is no thread. */
  closesAt: string | null;
  /** The guest's messages the host has not read yet. */
  unreadCount: number;
  /** The thread is open and the last message is the guest's. */
  needsReply: boolean;
  messages: GuestThreadMessage[];
}

/** One row of `GET /api/messages` (DB-14a, SR-12): a thread of the host's list, with the start of the guest's last message. */
export interface HostThreadSummary {
  bookingId: string;
  /** `XXXXX-XXXXX` */
  bookingCode: string;
  propertyId: string;
  propertyName: string;
  guestName: string;
  /** `YYYY-MM-DD` */
  checkInDate: string;
  /** `YYYY-MM-DD` */
  checkOutDate: string;
  state: 'Open' | 'Closed' | 'Unavailable';
  /** UTC instant. */
  lastMessageAt: string;
  lastMessageSender: GuestMessageSender | null;
  /** The first characters of the guest's last message, for the host only. */
  lastGuestMessagePreview: string | null;
  unreadCount: number;
  needsReply: boolean;
}
