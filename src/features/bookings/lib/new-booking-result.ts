import type { BookingOctorateSync, HostPaymentArrangement } from '@/types';

/**
 * How long the result of the new-booking wizard keeps asking by itself, every few seconds, for the channel manager to answer: the push runs after the
 * booking is written (the event bus), so the line "being sent" turns into its outcome while the host looks at it. After it the line says that no answer has
 * come, and the host asks again with a button.
 */
export const MIRROR_WATCH_MS = 90_000;

/**
 * After "Retry" the sync keeps its old state (`Failed`, `Conflict`) until the push really starts, a moment later: for this long the result says the push is
 * on its way instead of believing the old state. If the sync is still the old one after it, the push gave up and the line says so again.
 */
export const RETRY_GRACE_MS = 30_000;

/** How the last read of the booking ended, as far as the line is concerned. `idle`: it was not asked (nothing to ask, or not allowed to ask). */
export type MirrorRead = 'idle' | 'loading' | 'ok' | 'notFound' | 'failed';

/**
 * The read of the booking as the line takes it. An error comes first, and a 404 is `notFound` even when the query still holds data: a query keeps its old data when
 * a later read fails, and a booking that is not found is not a booking whose state is the cached one.
 */
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
  /** The key of the plain reason, for `failed`, `conflict` and `blocked`. */
  reasonKey: string | null;
  /** The host may ask for the push again (the API says so: the state is retryable and the caller may write the booking). */
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

/** The reason for a code of the sync; a code this client has no words for (a newer API) gets the generic one, never the raw code. */
export function syncReasonKey(code: string | null | undefined): string {
  return (code ? REASON_KEYS[code] : undefined) ?? `${REASON_PREFIX}.unknown`;
}

/** Every key `syncReasonKey` can answer (for the test that every one is translated). */
export const SYNC_REASON_KEYS: readonly string[] = [...Object.values(REASON_KEYS), `${REASON_PREFIX}.unknown`];

export interface MirrorLineInput {
  /** The property is mirrored on the channel manager, as the availability said before the booking was written; `null` when it is not known. */
  expected: boolean | null;
  /** The mirror of the booking as the last read gave it: `null` when the booking has none, `undefined` while nothing was read. */
  sync: BookingOctorateSync | null | undefined;
  read: MirrorRead;
  /** The time the result waits for the channel manager is over. */
  watchOver: boolean;
  /** "Retry" was accepted a moment ago: the sync may still show the state it had. */
  retrying: boolean;
}

function line(kind: MirrorLineKind, reasonKey: string | null = null, canRetry = false): MirrorLine {
  return { kind, reasonKey, canRetry };
}

/**
 * The line of the channel manager on the result, or `null` for no line at all: a property that is not connected has none, and nothing is said about a
 * connection that is not there. A booking of a mirrored property has one from the first moment, "being sent", even before the push has written its first row.
 */
export function mirrorLineOf({ expected, sync, read, watchOver, retrying }: MirrorLineInput): MirrorLine | null {
  if (read === 'idle') return null;
  // A 404 is "not found", whatever an earlier read left in the cache: the query keeps its old data when a later read fails.
  if (read === 'notFound') return line('notFound');

  if (sync) {
    if (retrying && (sync.state === 'Failed' || sync.state === 'Conflict')) return line('pending');
    switch (sync.state) {
      case 'Pending':
        // Still being sent as far as the last read goes; once the result has stopped following it, it does not claim to know: it says no answer has come.
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
        // A state this client does not know: not completed as far as it can tell.
        return line('waiting');
    }
  }

  // No mirror on the booking: either the property is not connected (no line), or the push has not written its row yet.
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

/** How the guest pays, as the result tells it: a link that was sent, a link that could not be made, the two ways the host records by hand, or a portal that collects. */
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

/** The one step the result suggests: the most urgent thing first (a channel manager that did not take the booking leaves the dates open elsewhere). */
export type NextStepKey = 'retryChannelManager' | 'checkChannelManager' | 'sendPaymentLink' | 'recordIncome' | 'checkIn';

export function nextStepOf(mirror: MirrorLine | null, payment: PaymentLineKind): NextStepKey {
  if (mirror) {
    if (mirror.kind === 'failed' || mirror.kind === 'conflict') return mirror.canRetry ? 'retryChannelManager' : 'checkChannelManager';
    // Nights taken on the channel manager: a new try meets the same refusal, the host has to look at the calendars (the button, if the API offers it, stays on the line).
    if (mirror.kind === 'datesTaken' || mirror.kind === 'blocked' || mirror.kind === 'waiting' || mirror.kind === 'unreadable' || mirror.kind === 'notFound') {
      return 'checkChannelManager';
    }
  }
  if (payment === 'linkMissing') return 'sendPaymentLink';
  if (payment === 'onSite' || payment === 'bankTransfer') return 'recordIncome';
  return 'checkIn';
}
