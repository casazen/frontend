import type { MessageContactChannel } from './message-hub.types';

// Scheduled messages of a booking (E05/F07/US02, NF-71, MSG-11, ADR-022): mirror the backend contract
// `Casazen.Web/DTOs/Messages/ScheduledMessageDtos.cs`, `ScheduledMessagesController` and the enum `ScheduledMessageStatus`.
// Behind the backend flag `Features:ScheduledMessages` (the client reads `scheduledMessages`): with it off the three endpoints answer 404.

/**
 * Where a message stands (`ScheduledMessageStatus`): `Scheduled`, `Blocked` and `Failed` are the open ones, the three that can still change
 * (the server says it with `canEdit`, `canSkip` and `canSendNow`); `Sent`, `Skipped`, `Cancelled` and `Expired` are over.
 */
export type ScheduledMessageStatus = 'Scheduled' | 'Sent' | 'Skipped' | 'Blocked' | 'Failed' | 'Cancelled' | 'Expired';

/**
 * One message of the timeline of a booking (`GET api/bookings/{id}/scheduled-messages`): when it goes out (`plannedAtUtc`, to be shown on the clock of the property, `timeZone`) and
 * what the routine that holds it is called, its state with the stable code of why it is held back or ended, whether the host edited it, how the guest is reached now and the text as
 * it will read.
 */
export interface ScheduledMessage {
  id: string;
  bookingId: string;
  /** The routine that holds the message; `null` once the routine was deleted (the name stays). */
  routineId: string | null;
  routineName: string;
  actionIndex: number;
  /** When it goes out (UTC). */
  plannedAtUtc: string;
  /** The IANA zone of the property (`Europe/Rome`): the clock the planned time is read on. */
  timeZone: string;
  status: ScheduledMessageStatus;
  /** Why a `Blocked` message waits or why the last send of a `Failed` one did not go: `variable_missing:{name}`, `id_not_verified`, a code of the channel. */
  blockedReason: string | null;
  /** Why a message that did not go out ended (`person`, `channel_rule`, `campaign_needs_consent`, `booking_cancelled`, `missed`, …). */
  skipReason: string | null;
  /** The host changed the text for this booking. */
  edited: boolean;
  /** It went out outside the send window (late, or by hand). */
  outsideHours: boolean;
  /** When it went out (UTC); also set on a message a person skipped while its send was under way, which did go out. */
  sentAt: string | null;
  /** The conversation it was written in (`ota:…` or `direct:…`); `null` for an e-mail and for a message that did not go. */
  sentThreadKey: string | null;
  /** How the guest is reached now: only for an open message (`None` with `channelReason` when there is no way, and always `None` for a message that is over). */
  channel: MessageContactChannel;
  channelReason: string | null;
  /** The text as it will read: the check-in link, the access code and the review link are `[check_in_link]`, `[access_code]` and `[review_link]`. `null` for a message that is over. */
  text: string | null;
  /** The variables of the text the booking has no value for. */
  missingVariables: string[];
  canEdit: boolean;
  canSkip: boolean;
  canSendNow: boolean;
}

/** `PUT api/scheduled-messages/{id}`: the new text of this message, or an empty text to go back to the template of the routine. */
export interface EditScheduledMessageRequest {
  text: string | null;
}
