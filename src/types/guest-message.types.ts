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
