import type { BookingOctorateSync } from '@/types';

/** How often a page that waits for the channel manager asks the booking again. */
export const SYNC_POLL_MS = 3_000;

/** The same, once the first minute is over and the push is still going on: a push that failed is tried again by itself, minutes later, and the page stays right. */
const SYNC_SLOW_POLL_MS = 15_000;

/**
 * How long, after the host's own action (a save, a cancellation, "Retry now"), the page keeps asking for the answer. The push to the channel manager runs a few seconds
 * later, through the event bus, and until it starts the row of the booking still says what it said before: a page that read it once would show the old state for good.
 */
export const SYNC_WATCH_MS = 60_000;

/** What a page that waits for the channel manager knows: when it opened and when the host last asked for something to be sent (`null` if they did not). */
export interface SyncWatch {
  openedAt: number;
  askedAt: number | null;
}

/**
 * Milliseconds until the page asks the booking again, or `false` for never. There is no push of the server for the outcome of a sync, so the page asks, and only while
 * there is something to wait for: a push under way (`Pending`), or the minute after the host asked for one (the row has not moved yet). Anything else is final for this
 * visit. `now` is a parameter so that the rule is told apart from the clock.
 */
export function syncPollInterval(sync: BookingOctorateSync | null | undefined, watch: SyncWatch, now: number = Date.now()): number | false {
  if (watch.askedAt !== null && now - watch.askedAt < SYNC_WATCH_MS) return SYNC_POLL_MS;
  if (sync?.state === 'Pending') return now - watch.openedAt < SYNC_WATCH_MS ? SYNC_POLL_MS : SYNC_SLOW_POLL_MS;
  return false;
}

/** Why a push failed, in the words of the screen: the sentence of each stable code of the API (`booking.syncReason.*`); a code this client does not know has a generic one. */
const SYNC_REASON_KEYS: Readonly<Record<string, string>> = {
  octorate_dates_unavailable: 'booking.syncReason.datesUnavailable',
  octorate_not_mirrored: 'booking.syncReason.notMirrored',
  octorate_payments_not_recorded: 'booking.syncReason.paymentsNotRecorded',
  octorate_rejected: 'booking.syncReason.rejected',
  octorate_reservation_changed: 'booking.syncReason.reservationChanged',
  octorate_reservation_linked_elsewhere: 'booking.syncReason.linkedElsewhere',
  octorate_room_not_chosen: 'booking.syncReason.roomNotChosen',
  octorate_unavailable: 'booking.syncReason.unavailable',
};

/** The key of the sentence that says why a push failed (`errorCode` of the mirror). */
export function syncReasonKey(code: string | null | undefined): string {
  return (code ? SYNC_REASON_KEYS[code] : undefined) ?? 'booking.syncReason.unknown';
}

/**
 * The failures the server tries again by itself (the event bus delivers the push again): the channel manager that gave no answer, a 429 or a 5xx. The others wait for the
 * host: a refusal is not tried again, and neither is a payment the channel manager refused to record; a payment that failed for want of an answer is, but the row carries
 * the same code for both (`octorate_payments_not_recorded`), so it cannot promise a retry.
 */
const SELF_RETRIED_CODES: readonly string[] = ['octorate_unavailable'];

/** Whether the server tries a push that failed with `code` again without being asked. */
export function syncRetriesByItself(code: string | null | undefined): boolean {
  return !!code && SELF_RETRIED_CODES.includes(code);
}
