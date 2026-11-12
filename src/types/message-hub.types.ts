/**
 * The hub of messages (E05/F02, NF-61): the conversations of the channels and the direct ones, in one list and one thread model. The
 * shapes are the ones of `MessageHubDtos.cs`; the enums travel as their names. The interface says «il canale» and never the name of
 * the channel manager (NF-12), so none of these types carries it.
 */
import type { BookingStatus } from './booking.types';

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

/** Who a message is for: the guest wrote an `Inbound` one, the host side an `Outbound` one. */
export type MessageHubDirection = 'Inbound' | 'Outbound';

/**
 * Where an outbound message of a channel is on its way to the guest: `Created` and `WaitingAuthorization` (the channel has it and sends
 * it), `Sent`, `Error` (the channel refused it) or `ManualVerify` (the outcome is not known: a person checks on the channel before it is
 * sent again, never by a second send).
 */
export type MessageHubDeliveryState = 'Created' | 'WaitingAuthorization' | 'Sent' | 'Error' | 'ManualVerify';

/** The file of a message: its type only. It is opened through the API, never by an address of the channel. */
export interface MessageHubAttachment {
  contentType: string;
}

/** One message of a conversation: plain text, shown as text, never as markup or links. */
export interface MessageHubMessage {
  id: string;
  direction: MessageHubDirection;
  origin: MessageHubOrigin;
  /** The situation an assistant message answered. */
  ruleCode?: string | null;
  /** The name the channel gives the person who wrote it; absent for a message written in CasaZen. */
  senderName?: string | null;
  text: string;
  /** UTC instant. */
  sentAt: string;
  readAt?: string | null;
  /** Only on an outbound message of a channel. */
  deliveryState?: MessageHubDeliveryState | null;
  attachment?: MessageHubAttachment | null;
}

/** The amounts of the booking in the currency of its card. A figure that is not available is absent, never zero; the whole object is absent for who may not read payments. */
export interface MessageBookingAmounts {
  total?: number;
  paid?: number;
  commission?: number;
  net?: number;
  balance?: number;
}

/** The booking beside a conversation. */
export interface MessageBookingCard {
  bookingId: string;
  /** `XXXXX-XXXXX` */
  bookingCode: string;
  guestName: string;
  /** `YYYY-MM-DD` (Rome date). */
  checkInDate: string;
  /** `YYYY-MM-DD` (Rome date). */
  checkOutDate: string;
  guests: number;
  adults: number;
  children: number;
  status: BookingStatus;
  /** `Direct`, `Airbnb`, `BookingCom`, … or `OtherChannel` (then {@link channelLabel} names the portal). */
  source: string;
  channelLabel?: string | null;
  currency: string;
  amounts?: MessageBookingAmounts | null;
}

/** What the host may do in the conversation; all false with a `reason` while it can be read and not answered. */
export interface MessageThreadActions {
  canReply: boolean;
  /** False on a request before the booking: no link, address or number may be written. */
  contactDetailsAllowed: boolean;
  attachmentsAllowed: boolean;
  autoReplyAllowed: boolean;
  /** `mapping_not_confirmed` or `thread_closed` when nothing is allowed. */
  reason?: string | null;
}

/** The link to the profile of the customer: the id of the guest of the booking (the route is built by the client). */
export interface MessageCustomer {
  guestId: string;
}

/** One conversation with everything the screen shows beside it (`GET /api/messages/threads/{threadKey}`). */
export interface MessageHubThreadDetail {
  threadKey: string;
  source: MessageHubSource;
  channel: MessageHubChannel;
  kind: MessageHubThreadKind;
  state: MessageHubThreadState;
  propertyId?: string | null;
  propertyName?: string | null;
  unassigned: boolean;
  guestName?: string | null;
  unreadCount: number;
  needsReply: boolean;
  /** The guest asked for the erasure of its data: the names are gone. */
  anonymized: boolean;
  booking?: MessageBookingCard | null;
  customer?: MessageCustomer | null;
  allowedActions: MessageThreadActions;
  /** The latest messages, oldest first. */
  messages: MessageHubMessage[];
  /** There are older messages than the ones the answer carries. */
  hasEarlierMessages: boolean;
}

/** What is still unread after the host marked the conversation as read. */
export interface MessageHubRead {
  threadKey: string;
  unreadCount: number;
}

/** How a guest can be written to from CasaZen. */
export type MessageContactChannel = 'None' | 'Ota' | 'Direct' | 'Email';

/**
 * The answer to a send (`POST …/reply`: 200, or 202 when the state is `ManualVerify`). `replayed`: the same `Idempotency-Key` had already
 * written it and nothing was sent. `message` is absent for an e-mail, which is not kept as a conversation.
 */
export interface MessageHubReply {
  channel: MessageContactChannel;
  threadKey?: string | null;
  message?: MessageHubMessage | null;
  state: MessageHubDeliveryState;
  replayed: boolean;
  errorCode?: string | null;
}

/**
 * How the guest of a booking can be written to now (`GET /api/bookings/{id}/contact-options`). Never an address or a number: only
 * whether they exist. `reason` is a stable code when there is no channel.
 */
export interface MessageContactOptions {
  channel: MessageContactChannel;
  threadKey?: string | null;
  reason?: string | null;
  emailAvailable: boolean;
  phoneAvailable: boolean;
}

/** A template of the host (`api/message-templates`): the text with its variables, in the language it is written in. */
export interface HostMessageTemplate {
  id: string;
  name: string;
  /** One of the 14 languages of the listing, lower case. */
  language: string;
  body: string;
  isActive: boolean;
  variables: string[];
  updatedAt: string;
}

/** A template the channel keeps for a conversation: read only, to copy into the composer. */
export interface ChannelMessageTemplate {
  name: string;
  language?: string | null;
  text: string;
}

/** The text of a template for a conversation, with the variables filled in. */
export interface RenderedMessageTemplate {
  text: string;
}

/** What to translate: a message of the conversation, or a text the host is writing. */
export interface MessageTranslationRequest {
  threadKey: string;
  messageId?: string;
  text?: string;
  /** One of the 14 languages of the listing. */
  targetLanguage: string;
}

/** A translation, for the screen only: it is always a machine translation and never replaces the original. */
export interface MessageTranslation {
  text: string;
  targetLanguage: string;
  machineTranslated: boolean;
}
