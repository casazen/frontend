/**
 * The hub of messages (E05/F02, NF-61): the conversations of the channels and the direct ones, in one list and one thread model. The
 * shapes are the ones of `MessageHubDtos.cs`; the enums travel as their names. The interface says «il canale» and never the name of
 * the channel manager (NF-12), so none of these types carries it.
 */
import type { BookingStatus } from './booking.types';

type MessageHubSource = 'Direct' | 'Ota' | 'Storefront' | 'Review' | 'OtaReview';

export type MessageHubChannel = 'Direct' | 'Airbnb' | 'Booking' | 'Vrbo' | 'Expedia' | 'Storefront';

export const MESSAGE_HUB_CHANNELS: readonly MessageHubChannel[] = ['Direct', 'Airbnb', 'Booking', 'Vrbo', 'Expedia', 'Storefront'];

type MessageHubThreadKind = 'Reservation' | 'Request' | 'Review';

type MessageHubThreadState = 'Open' | 'Closed' | 'Archived';

type MessageHubOrigin = 'Guest' | 'Person' | 'Assistant' | 'Automation';

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
  bookingCode?: string | null;
  guestName?: string | null;
  checkInDate?: string | null;
  checkOutDate?: string | null;
  lastMessageAt: string;
  lastMessageOrigin?: MessageHubOrigin | null;
  preview?: string | null;
  unreadCount: number;
  needsReply: boolean;
  rating?: number | null;
}

export interface MessageHubPage {
  items: MessageHubThread[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export interface MessageHubFilters {
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

interface MessageHubUnreadItem {
  threadKey: string;
  bookingId?: string | null;
  unreadCount: number;
}

export interface MessageHubUnread {
  items: MessageHubUnreadItem[];
}

type MessageHubDirection = 'Inbound' | 'Outbound';

/**
 * Where an outbound message of a channel is on its way to the guest: `Created` and `WaitingAuthorization` (the channel has it and sends
 * it), `Sent`, `Error` (the channel refused it) or `ManualVerify` (the outcome is not known: a person checks on the channel before it is
 * sent again, never by a second send).
 */
type MessageHubDeliveryState = 'Created' | 'WaitingAuthorization' | 'Sent' | 'Error' | 'ManualVerify';

interface MessageHubAttachment {
  contentType: string;
}

export interface MessageHubMessage {
  id: string;
  direction: MessageHubDirection;
  origin: MessageHubOrigin;
  ruleCode?: string | null;
  senderName?: string | null;
  text: string;
  sentAt: string;
  readAt?: string | null;
  deliveryState?: MessageHubDeliveryState | null;
  attachment?: MessageHubAttachment | null;
}

export interface MessageBookingAmounts {
  total?: number;
  paid?: number;
  commission?: number;
  net?: number;
  balance?: number;
}

export interface MessageBookingCard {
  bookingId: string;
  bookingCode: string;
  guestName: string;
  checkInDate: string;
  checkOutDate: string;
  guests: number;
  adults: number;
  children: number;
  status: BookingStatus;
  source: string;
  channelLabel?: string | null;
  currency: string;
  amounts?: MessageBookingAmounts | null;
}

interface MessageThreadActions {
  canReply: boolean;
  contactDetailsAllowed: boolean;
  attachmentsAllowed: boolean;
  autoReplyAllowed: boolean;
  reason?: string | null;
}

export interface MessageCustomer {
  guestId: string;
}

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
  visitorEmail?: string | null;
  unreadCount: number;
  needsReply: boolean;
  anonymized: boolean;
  booking?: MessageBookingCard | null;
  customer?: MessageCustomer | null;
  allowedActions: MessageThreadActions;
  messages: MessageHubMessage[];
  hasEarlierMessages: boolean;
}

export interface MessageHubRead {
  threadKey: string;
  unreadCount: number;
}

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

export interface MessageContactOptions {
  channel: MessageContactChannel;
  threadKey?: string | null;
  reason?: string | null;
  emailAvailable: boolean;
  phoneAvailable: boolean;
}

export type MessageChannelStatusCode = 'pending_sync' | 'available' | 'waiting_permission' | 'error';

export interface MessageChannelStatusItem {
  propertyId: string;
  propertyName: string;
  status: MessageChannelStatusCode;
  lastCheckedAt?: string | null;
}

export interface MessageChannelStatus {
  items: MessageChannelStatusItem[];
}

export interface HostMessageTemplate {
  id: string;
  name: string;
  language: string;
  body: string;
  isActive: boolean;
  variables: string[];
  updatedAt: string;
}

export interface ChannelMessageTemplate {
  name: string;
  language?: string | null;
  text: string;
}

export interface RenderedMessageTemplate {
  text: string;
}

export interface MessageTranslationRequest {
  threadKey: string;
  messageId?: string;
  text?: string;
  targetLanguage: string;
}

export interface MessageTranslation {
  text: string;
  targetLanguage: string;
  machineTranslated: boolean;
}
