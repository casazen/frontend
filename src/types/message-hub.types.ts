/**
 * The hub of messages (E05/F02, NF-61): the conversations of the channels and the direct ones, in one list and one thread model. The
 * shapes are the ones of `MessageHubDtos.cs`; the enums travel as their names. The interface says «il canale» and never the name of
 * the channel manager (NF-12), so none of these types carries it.
 */

/** Where the conversation lives: the one with the guest of a direct booking, or one of a channel. */
export type MessageHubSource = 'Direct' | 'Ota';

/** The channel of a conversation: the direct one, or one of the four channels that have an integrated chat. */
export type MessageHubChannel = 'Direct' | 'Airbnb' | 'Booking' | 'Vrbo' | 'Expedia';

export const MESSAGE_HUB_CHANNELS: readonly MessageHubChannel[] = ['Direct', 'Airbnb', 'Booking', 'Vrbo', 'Expedia'];

/** What the conversation is about: a reservation, or a request with no booking yet (an inquiry). */
export type MessageHubThreadKind = 'Reservation' | 'Request';

/** Whether the conversation is still being worked on. */
export type MessageHubThreadState = 'Open' | 'Closed' | 'Archived';

/** Who wrote a message: the guest, a person of the host side, or the assistant of CasaZen. */
export type MessageHubOrigin = 'Guest' | 'Person' | 'Assistant';

/**
 * One conversation of the list (`GET /api/messages?includeOta=true`). `threadKey` is the opaque key every other call takes: the client
 * hands back what the server gave it and never builds one. A conversation whose listing is not yet linked to a property has no
 * property (`unassigned`).
 */
export interface MessageHubThread {
  threadKey: string;
  source: MessageHubSource;
  channel: MessageHubChannel;
  kind: MessageHubThreadKind;
  state: MessageHubThreadState;
  propertyId?: string | null;
  propertyName?: string | null;
  unassigned: boolean;
  bookingId?: string | null;
  /** `XXXXX-XXXXX` */
  bookingCode?: string | null;
  guestName?: string | null;
  /** `YYYY-MM-DD` (Rome date). */
  checkInDate?: string | null;
  /** `YYYY-MM-DD` (Rome date). */
  checkOutDate?: string | null;
  /** UTC instant. */
  lastMessageAt: string;
  lastMessageOrigin?: MessageHubOrigin | null;
  /** The start of the last message, for the host only; `null` for a message that is only a file. */
  preview?: string | null;
  unreadCount: number;
  /** Open, with the guest's message last: the conversation of the «Da rispondere» list. */
  needsReply: boolean;
}

/** A page of `GET /api/messages?includeOta=true`. */
export interface MessageHubPage {
  items: MessageHubThread[];
  totalCount: number;
  page: number;
  pageSize: number;
}

/** The filters of the list, all optional and combined with AND. `q` matches the guest, the booking code and the property, never the words of a message. */
export interface MessageHubFilters {
  /** True keeps the open conversations that wait for the host's answer. */
  needsReply?: boolean;
  propertyId?: string;
  channel?: MessageHubChannel;
  bookingId?: string;
  unread?: boolean;
  kind?: MessageHubThreadKind;
  q?: string;
  page?: number;
  pageSize?: number;
}

/** One conversation with something unread: counters only, no name and no text. */
export interface MessageHubUnreadItem {
  threadKey: string;
  bookingId?: string | null;
  unreadCount: number;
}

/** `GET /api/messages/unread?includeOta=true`. */
export interface MessageHubUnread {
  items: MessageHubUnreadItem[];
}
