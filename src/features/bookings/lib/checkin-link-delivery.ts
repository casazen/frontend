import type { CheckInLinkDelivery, CheckInLinkDeliveryState } from '@/types/checkin-link.types';
import type { CheckInLinkEmailStatus } from '@/types/public-checkin.types';

/** How a line about the link is drawn: done, working on its own, waiting for something that is not the host's to do, or a problem. An icon and a word always go with it. */
export type DeliveryTone = 'done' | 'working' | 'waiting' | 'problem';

/** What the guest panel of a booking says about the way of the check-in link to the guest (E23/F01/US02, NF-122): one line, the sentence under it, and who has to act. */
export interface DeliveryLine {
  tone: DeliveryTone;
  /** The key of the line: where the link stands. */
  labelKey: string;
  /** The key of the sentence under it (what the link waits for, or why it did not arrive); `null` when the line says it all. */
  hintKey: string | null;
  /** The link has not reached the guest and the host may have to carry it: «Copia link» is offered to whoever can already copy one. */
  needsTheHost: boolean;
}

/** What waits, in each waiting state: the one line and its sentence. Written out (`*Key:`) so that the test of the texts finds a missing translation. */
const WAITING: Partial<Record<CheckInLinkDeliveryState, Pick<DeliveryLine, 'labelKey' | 'hintKey'>>> = {
  WaitingChatPermission: {
    labelKey: 'checkin.link.delivery.waitingChatPermission',
    hintKey: 'checkin.link.delivery.waitingChatPermissionHint',
  },
  WaitingThread: { labelKey: 'checkin.link.delivery.waitingThread', hintKey: 'checkin.link.delivery.waitingThreadHint' },
  WaitingContact: { labelKey: 'checkin.link.delivery.waitingContact', hintKey: 'checkin.link.delivery.waitingContactHint' },
  WaitingStaticIps: { labelKey: 'checkin.link.delivery.waitingStaticIps', hintKey: 'checkin.link.delivery.waitingStaticIpsHint' },
};

/**
 * Why a delivery failed, by the stable code of the server. A code this version does not know is told with the generic sentence: never the code, and never a
 * name of the channel manager (the codes that carry it are said as «la chat del portale» or «il tuo channel manager»). The keys are written out (`reasonKey:`)
 * so that the test of the texts finds a missing translation.
 */
const FAILURE_REASONS: Readonly<Record<string, { reasonKey: string }>> = {
  chat_not_licensed: { reasonKey: 'checkin.link.delivery.reason.chatNotLicensed' },
  manual_verify: { reasonKey: 'checkin.link.delivery.reason.manualVerify' },
  mapping_not_confirmed: { reasonKey: 'checkin.link.delivery.reason.mappingNotConfirmed' },
  no_conversation: { reasonKey: 'checkin.link.delivery.reason.noConversation' },
  octorate_message_error: { reasonKey: 'checkin.link.delivery.reason.messageRefused' },
  octorate_not_connected: { reasonKey: 'checkin.link.delivery.reason.notConnected' },
  octorate_rate_limited: { reasonKey: 'checkin.link.delivery.reason.rateLimited' },
  octorate_unavailable: { reasonKey: 'checkin.link.delivery.reason.unavailable' },
  thread_closed: { reasonKey: 'checkin.link.delivery.reason.threadClosed' },
};

const UNKNOWN_FAILURE_REASON = { reasonKey: 'checkin.link.delivery.reason.unknown' };

/**
 * Why a delivery ended because ANOTHER link took the place of the one it carried (`CheckInLinkEndReasons.HostLink`, `LinkReplaced`): the host generated or sent a new
 * link, and the old one stopped working. The server ends the row and leaves its state as it was, so a `Sent` row of such a delivery is the history of a dead link, not the
 * state of the link now.
 */
const LINK_REPLACED_REASONS: ReadonlySet<string> = new Set(['host_link', 'link_replaced']);

/** The sentence of a failed delivery for its code. */
function failureReasonKey(code: string | null | undefined): string {
  return (code && Object.hasOwn(FAILURE_REASONS, code) ? FAILURE_REASONS[code] : UNKNOWN_FAILURE_REASON).reasonKey;
}

interface DeliveryContext {
  /** The state of the e-mail of the same link, as the check-in session records it: the real outcome of an e-mail the delivery only handed to the queue. */
  emailStatus?: CheckInLinkEmailStatus | null;
  /** The link cannot be used any more (the guest completed the check-in, or it expired): what it was waiting for no longer matters. */
  linkClosed: boolean;
}

/**
 * The line the panel shows for the delivery of the link, or `null` when it says nothing (no delivery, a state this version does not know, a delivery that
 * ended, a link that is no longer usable). What did not happen is never told as done (UX-09):
 * - `Sent` is told only for the link it carried: a delivery that ended because the host issued another link (`host_link`, `link_replaced`) is about a link that no
 *   longer works, and says nothing (the line of the e-mail and the link just issued tell what there is); one that ended with the check-in, the expiry or the booking
 *   keeps its line, which is true;
 * - `Sent` by e-mail is told only while nothing contradicts it: an e-mail the provider refused, that is still in the queue or that the session says was never asked
 *   for is the business of the e-mail line;
 * - `Sending` is a message with the channel that has not left yet, so it is «in invio», never «inviato»;
 * - the waiting and failed states are told only while the link is still usable and the delivery is open.
 */
export function describeDelivery(delivery: CheckInLinkDelivery | null | undefined, context: DeliveryContext): DeliveryLine | null {
  const state = delivery?.state;
  if (!delivery || !delivery.channel || !state) return null;

  if (state === 'Sent') {
    if (delivery.ended && delivery.endedReason && LINK_REPLACED_REASONS.has(delivery.endedReason)) return null;
    if (delivery.channel === 'Email') {
      if (context.emailStatus === 'Failed' || context.emailStatus === 'Queued' || context.emailStatus === 'NotRequested') return null;
      return { tone: 'done', labelKey: 'checkin.link.delivery.sentEmail', hintKey: null, needsTheHost: false };
    }
    const labelKey = delivery.channel === 'PortalChat' ? 'checkin.link.delivery.sentPortalChat' : 'checkin.link.delivery.sent';
    return { tone: 'done', labelKey, hintKey: null, needsTheHost: false };
  }

  if (delivery.ended || context.linkClosed) return null;

  if (state === 'Sending') {
    return { tone: 'working', labelKey: 'checkin.link.delivery.sending', hintKey: 'checkin.link.delivery.sendingHint', needsTheHost: false };
  }
  if (state === 'Failed') {
    return { tone: 'problem', labelKey: 'checkin.link.delivery.failed', hintKey: failureReasonKey(delivery.lastErrorCode), needsTheHost: true };
  }
  const waiting = Object.hasOwn(WAITING, state) ? WAITING[state] : undefined;
  return waiting ? { tone: 'waiting', ...waiting, needsTheHost: true } : null;
}

/**
 * The link the host may copy: only for who holds the permission to copy one (`booking.write`), only while the link has not reached the guest and the
 * delivery is open, and only when the server gave it. Whatever the server sent to a caller without the permission is never used.
 */
export function linkToCopy(delivery: CheckInLinkDelivery | null | undefined, line: DeliveryLine | null, canWrite: boolean): string | null {
  if (!canWrite || !delivery || delivery.ended || !line?.needsTheHost) return null;
  const link = delivery.checkInLink?.trim();
  return link ? link : null;
}
