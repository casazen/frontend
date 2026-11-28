import type { BookingOctorateSync, HostPaymentArrangement } from '@/types';

export const MIRROR_WATCH_MS = 90_000;

/**
 * After "Retry" the sync keeps its old state (`Failed`, `Conflict`) until the push really starts, a moment later: for this long the result says the push is
 * on its way instead of believing the old state. If the sync is still the old one after it, the push gave up and the line says so again.
 */
export const RETRY_GRACE_MS = 30_000;

export type MirrorRead = 'idle' | 'loading' | 'ok' | 'notFound' | 'failed';

export function mirrorReadOf(input: { enabled: boolean; isError: boolean; notFound: boolean; hasData: boolean }): MirrorRead {
  if (!input.enabled) return 'idle';
  if (input.isError) return input.notFound ? 'notFound' : 'failed';
  return input.hasData ? 'ok' : 'loading';
}

/**
 * What the result says about the channel manager. `pending` is "being sent", the only state that is on its way; every other one but `synced` is a state that is
 * not completed, and is said as such: `failed` and `conflict` with their reason, `datesTaken` (a creation the channel manager refused because the nights are already
 * taken there: the booking is in CasaZen and not on the channel manager, and the same nights may be sold twice), `blocked` (the channel does not allow it),
 * `waiting` (the answer has not come in the time the result waits), `unreadable` (the state could not be read) and `notFound` (the booking is not found: a 404 is
 * that whatever an earlier read left in the cache).
 */
export type MirrorLineKind = 'pending' | 'synced' | 'failed' | 'conflict' | 'datesTaken' | 'blocked' | 'waiting' | 'unreadable' | 'notFound';

export interface MirrorLine {
  kind: MirrorLineKind;
  reasonKey: string | null;
  canRetry: boolean;
}

const REASON_PREFIX = 'booking.create.done.channelManager.reasons';

/** The code of a creation the channel manager refused because the nights are already taken there (`Conflict`, not tried again by itself). */
const DATES_TAKEN_CODE = 'octorate_dates_unavailable';

/** The words of each stable code of the sync, written out so that a missing translation is found by a test. */
const REASON_KEYS: Readonly<Record<string, string>> = {
  [DATES_TAKEN_CODE]: 'booking.create.done.channelManager.reasons.datesUnavailable',
  octorate_unavailable: 'booking.create.done.channelManager.reasons.unavailable',
  octorate_rejected: 'booking.create.done.channelManager.reasons.rejected',
  octorate_reservation_changed: 'booking.create.done.channelManager.reasons.reservationChanged',
  octorate_room_not_chosen: 'booking.create.done.channelManager.reasons.roomNotChosen',
  octorate_payments_not_recorded: 'booking.create.done.channelManager.reasons.paymentsNotRecorded',
  octorate_reservation_linked_elsewhere: 'booking.create.done.channelManager.reasons.linkedElsewhere',
  octorate_not_mirrored: 'booking.create.done.channelManager.reasons.notMirrored',
};

export function syncReasonKey(code: string | null | undefined): string {
  return (code ? REASON_KEYS[code] : undefined) ?? `${REASON_PREFIX}.unknown`;
}

export const SYNC_REASON_KEYS: readonly string[] = [...Object.values(REASON_KEYS), `${REASON_PREFIX}.unknown`];

export interface MirrorLineInput {
  expected: boolean | null;
  sync: BookingOctorateSync | null | undefined;
  read: MirrorRead;
  watchOver: boolean;
  /** "Retry" was accepted a moment ago: the sync may still show the state it had. */
  retrying: boolean;
}

function line(kind: MirrorLineKind, reasonKey: string | null = null, canRetry = false): MirrorLine {
  return { kind, reasonKey, canRetry };
}

export function mirrorLineOf({ expected, sync, read, watchOver, retrying }: MirrorLineInput): MirrorLine | null {
  if (read === 'idle') return null;
  if (read === 'notFound') return line('notFound');

  if (sync) {
    if (retrying && (sync.state === 'Failed' || sync.state === 'Conflict')) return line('pending');
    switch (sync.state) {
      case 'Pending':
        return line(watchOver ? 'waiting' : 'pending');
      case 'Synced':
        return line('synced');
      case 'Failed':
        return line('failed', syncReasonKey(sync.errorCode), sync.canRetry);
      case 'Conflict':
        // The channel manager refused the creation because the nights are taken there: there is no reservation of CasaZen on it that could differ from the booking, and
        // asking again meets the same refusal. Said as what it is; the button stays only where the API offers it.
        if (sync.errorCode === DATES_TAKEN_CODE) return line('datesTaken', null, sync.canRetry);
        return line('conflict', syncReasonKey(sync.errorCode ?? 'octorate_reservation_changed'), sync.canRetry);
      case 'NotAllowedByChannel':
        return line('blocked', syncReasonKey(sync.errorCode));
      default:
        return line('waiting');
    }
  }

  if (expected !== true) return null;
  if (read === 'failed') return line('unreadable');
  return line(watchOver ? 'waiting' : 'pending');
}

export interface MirrorWatchInput {
  sync: BookingOctorateSync | null | undefined;
  expected: boolean | null;
  watchOver: boolean;
  retrying: boolean;
}

/**
 * Whether the result keeps asking for the booking: while the answer is still to come (being sent, a retry on its way, or no row yet). With no row only a property
 * that is known not to be connected stops asking: when that is not known (`null`: a draft taken up at the summary, a stay whose availability was not read) the row
 * may still come, because the push writes it a moment after the booking, and a read made before it would never show a refusal of the channel manager. Nothing is
 * said while no row comes (`mirrorLineOf`), and it stops asking when the time the result waits is over.
 */
export function shouldWatchMirror({ sync, expected, watchOver, retrying }: MirrorWatchInput): boolean {
  if (watchOver) return false;
  if (sync) return sync.state === 'Pending' || (retrying && (sync.state === 'Failed' || sync.state === 'Conflict'));
  return expected !== false;
}

export type PaymentLineKind = 'linkSent' | 'linkMissing' | 'onSite' | 'bankTransfer' | 'portal' | 'none';

export function paymentLineOf(input: { arrangement: HostPaymentArrangement | ''; portal: boolean; hasLink: boolean }): PaymentLineKind {
  if (input.portal) return 'portal';
  switch (input.arrangement) {
    case 'paymentLink':
      return input.hasLink ? 'linkSent' : 'linkMissing';
    case 'onSite':
      return 'onSite';
    case 'bankTransfer':
      return 'bankTransfer';
    default:
      return 'none';
  }
}

export type NextStepKey = 'retryChannelManager' | 'checkChannelManager' | 'sendPaymentLink' | 'recordIncome' | 'checkIn';

export function nextStepOf(mirror: MirrorLine | null, payment: PaymentLineKind): NextStepKey {
  if (mirror) {
    if (mirror.kind === 'failed' || mirror.kind === 'conflict') return mirror.canRetry ? 'retryChannelManager' : 'checkChannelManager';
    if (mirror.kind === 'datesTaken' || mirror.kind === 'blocked' || mirror.kind === 'waiting' || mirror.kind === 'unreadable' || mirror.kind === 'notFound') {
      return 'checkChannelManager';
    }
  }
  if (payment === 'linkMissing') return 'sendPaymentLink';
  if (payment === 'onSite' || payment === 'bankTransfer') return 'recordIncome';
  return 'checkIn';
}
