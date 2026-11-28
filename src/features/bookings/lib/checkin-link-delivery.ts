import type { CheckInLinkDelivery, CheckInLinkDeliveryState } from '@/types/checkin-link.types';
import type { CheckInLinkEmailStatus } from '@/types/public-checkin.types';

export type DeliveryTone = 'done' | 'working' | 'waiting' | 'problem';

export interface DeliveryLine {
  tone: DeliveryTone;
  labelKey: string;
  hintKey: string | null;
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
 * The failures worth a retry, which the hourly job of the server tries again by itself while attempts are left (`CheckInLinkDeliveryService.TransientCodes`): a limit and an
 * outage of the channel manager. Their sentence while a retry is still to come says that CasaZen will try again shortly, not that it tried several times.
 */
const RETRIED_FAILURE_REASONS: Readonly<Record<string, { reasonKey: string }>> = {
  octorate_rate_limited: { reasonKey: 'checkin.link.delivery.reason.rateLimitedRetrying' },
  octorate_unavailable: { reasonKey: 'checkin.link.delivery.reason.unavailableRetrying' },
};

/**
 * The attempts after which a failure worth a retry is final (`CheckInLinkDeliveryRules.MaxAttempts`, the first attempt included): the server counts them in `attempts` and stops
 * trying again there. Below it the failure is not final (`IsFinalFailure`), and the host is not told that the link was tried several times.
 */
const MAX_AUTOMATIC_ATTEMPTS = 3;

/**
 * Why a delivery ended because ANOTHER link took the place of the one it carried (`CheckInLinkEndReasons.HostLink`, `LinkReplaced`): the host generated or sent a new
 * link, and the old one stopped working. The server ends the row and leaves its state as it was, so a `Sent` row of such a delivery is the history of a dead link, not the
 * state of the link now.
 */
const LINK_REPLACED_REASONS: ReadonlySet<string> = new Set(['host_link', 'link_replaced']);

function failureReasonKey(code: string | null | undefined): string {
  return (code && Object.hasOwn(FAILURE_REASONS, code) ? FAILURE_REASONS[code] : UNKNOWN_FAILURE_REASON).reasonKey;
}

interface DeliveryContext {
  emailStatus?: CheckInLinkEmailStatus | null;
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
 * - a `Failed` that is worth a retry (a limit, an outage) and has attempts left is «non ancora arrivato, riproviamo tra poco»; the sentences that say it was tried several
 *   times are for the failure that is final;
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
    // A failure worth a retry with attempts left is not final: the server tries again by itself within the hour. It is told as «not yet», with the way to carry the link meanwhile, and
    // never as tried several times; only the final failure keeps the sentences that say so.
    const code = delivery.lastErrorCode;
    if (code && Object.hasOwn(RETRIED_FAILURE_REASONS, code) && delivery.attempts < MAX_AUTOMATIC_ATTEMPTS) {
      return { tone: 'waiting', labelKey: 'checkin.link.delivery.retrying', hintKey: RETRIED_FAILURE_REASONS[code].reasonKey, needsTheHost: true };
    }
    return { tone: 'problem', labelKey: 'checkin.link.delivery.failed', hintKey: failureReasonKey(code), needsTheHost: true };
  }
  const waiting = Object.hasOwn(WAITING, state) ? WAITING[state] : undefined;
  return waiting ? { tone: 'waiting', ...waiting, needsTheHost: true } : null;
}

export function linkToCopy(delivery: CheckInLinkDelivery | null | undefined, line: DeliveryLine | null, canWrite: boolean): string | null {
  if (!canWrite || !delivery || delivery.ended || !line?.needsTheHost) return null;
  const link = delivery.checkInLink?.trim();
  return link ? link : null;
}
