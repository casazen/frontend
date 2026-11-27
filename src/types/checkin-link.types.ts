/**
 * Where the check-in link of a booking stands on its way to the guest, as the host sees it (E23/F01, NF-122). The shapes are the ones of
 * `CheckInLinkDtos.cs` (`GET /api/bookings/{id}/checkin/link-delivery`); the enums travel as their names. The interface says «la chat del
 * portale» and never the name of the channel manager (NF-12): the codes below are the server's, and the texts a person reads are not made of them.
 */

/** The way the link goes (or is going) to the guest: an e-mail, one message in the reservation chat of the portal, or the host's own hands. */
type CheckInLinkChannel = 'Email' | 'PortalChat' | 'Manual';

/**
 * Where the delivery stands. `Sent` is a link that left (the channel says so, or the e-mail is with its queue), `Sending` a message with the
 * channel that has not left yet, the four `Waiting…` states a link that waits for something that is never the guest's doing, `Failed` a
 * delivery that ended with `lastErrorCode`.
 */
export type CheckInLinkDeliveryState =
  | 'Sent'
  | 'Sending'
  | 'WaitingChatPermission'
  | 'WaitingThread'
  | 'WaitingContact'
  | 'WaitingStaticIps'
  | 'Failed';

/**
 * The answer of `GET /api/bookings/{id}/checkin/link-delivery`. A booking that has no delivery record answers 200 with `channel` and `state`
 * empty. `checkInLink` is the link to copy («Copia link»): the server gives it only to a caller who can already copy one (`booking.write` on the
 * property), only while the delivery waits or failed and only while the link can still be opened; it is a secret that opens the guest page,
 * so it is kept nowhere but in the memory of the page.
 */
export interface CheckInLinkDelivery {
  channel?: CheckInLinkChannel | null;
  state?: CheckInLinkDeliveryState | null;
  attempts: number;
  /** The stable code of why a delivery failed or waits (`chat_not_licensed`, `no_conversation`, `manual_verify`, `octorate_message_error`, …). */
  lastErrorCode?: string | null;
  /** UTC instant. */
  sentAt?: string | null;
  /** The guest completed the check-in, the booking was cancelled, the link expired or the host issued another link. */
  ended: boolean;
  endedReason?: string | null;
  /** UTC instant: the end of validity of the link. */
  expiresAt?: string | null;
  checkInLink?: string | null;
}
