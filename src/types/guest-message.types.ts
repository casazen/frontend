export const GUEST_MESSAGE_MAX_LENGTH = 2000;

type GuestMessageSender = 'Guest' | 'Host';

export interface GuestThreadMessage {
  id: string;
  sender: GuestMessageSender;
  origin?: 'Guest' | 'Person' | 'Assistant' | 'Automation' | null;
  text: string;
  createdAt: string;
}

export interface GuestThread {
  state: 'Open' | 'Closed';
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

export interface HostThread {
  state: 'Open' | 'Closed' | 'Unavailable';
  closesAt: string | null;
  unreadCount: number;
  needsReply: boolean;
  messages: GuestThreadMessage[];
}

export interface HostThreadSummary {
  bookingId: string;
  bookingCode: string;
  propertyId: string;
  propertyName: string;
  guestName: string;
  checkInDate: string;
  checkOutDate: string;
  state: 'Open' | 'Closed' | 'Unavailable';
  lastMessageAt: string;
  lastMessageSender: GuestMessageSender | null;
  lastGuestMessagePreview: string | null;
  unreadCount: number;
  needsReply: boolean;
}
