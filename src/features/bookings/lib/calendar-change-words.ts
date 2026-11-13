import type { CalendarChange, CalendarChangeProperty, CalendarChangeState } from '@/types/calendar-changes.types';

/**
 * What a change of the calendar says about itself, in plain words and with the same vocabulary wherever it is told (the panel of the days, the result of the bulk wizard, the
 * line above the calendar and its list). Nothing is worded as "published": the channel manager accepting a change is "accepted by your channel manager", which is not the
 * change being on the portals; every state that is not completed is said as such, and an answer that could not be read is never taken for a success.
 */

/** How the last read of the change ended, as far as a line is concerned. `idle`: it was not asked (a caller that may not read it). */
export type ChangeRead = 'idle' | 'loading' | 'ok' | 'notFound' | 'failed';

/**
 * The read of a change as the line takes it. An error comes first, and a 404 is `notFound` even when the query still holds data: a query keeps its old data when a later read
 * fails, and a change that is not found is not a change whose state is the cached one.
 */
export function changeReadOf(input: { enabled: boolean; isError: boolean; notFound: boolean; hasData: boolean }): ChangeRead {
  if (!input.enabled) return 'idle';
  if (input.isError) return input.notFound ? 'notFound' : 'failed';
  return input.hasData ? 'ok' : 'loading';
}

/**
 * Where one property of a change stands. `saved` is what a change always is once the API has answered; the others are about the channel manager: `notConnected` (the change
 * stays in CasaZen), `waiting` and `sending` (on their way, the only moving states), `accepted` (the channel manager took it: not the same as on the portals), `confirmed`,
 * `failed` (with its reason, and a retry), `noAnswer` (still waiting when the screen stopped asking: neutral, not an error), `unreadable` (the state could not be read) and
 * `notFound` (the change is not found).
 */
export type ChangeLineKind = 'notConnected' | 'waiting' | 'sending' | 'accepted' | 'confirmed' | 'failed' | 'noAnswer' | 'unreadable' | 'notFound';

export interface ChangeLine {
  kind: ChangeLineKind;
  /** The key of the plain reason (`booking.calendar.change.error.*`), for `failed` and for a waiting change that says why it waits. */
  reasonKey: string | null;
  /** The host may send it again: the line is `failed` and the change is one the API lets be retried. */
  canRetry: boolean;
}

const ERROR_PREFIX = 'booking.calendar.change.error';

/** The words of each stable code of a change, written out so that a missing translation is found by a test. */
const ERROR_KEYS: Readonly<Record<string, string>> = {
  octorate_room_not_chosen: `${ERROR_PREFIX}.roomNotChosen`,
  octorate_room_not_licensed: `${ERROR_PREFIX}.roomNotLicensed`,
  octorate_quota_low: `${ERROR_PREFIX}.quotaLow`,
  octorate_unavailable: `${ERROR_PREFIX}.unavailable`,
  octorate_not_authorized: `${ERROR_PREFIX}.notAuthorized`,
  octorate_channel_error: `${ERROR_PREFIX}.channelError`,
  octorate_request_rejected: `${ERROR_PREFIX}.rejected`,
};

/** The reason for a code of a change; a code this client has no words for (a newer API) gets the generic one, never the raw code. */
export function changeReasonKey(code: string | null | undefined): string {
  return (code ? ERROR_KEYS[code] : undefined) ?? `${ERROR_PREFIX}.unknown`;
}

/** Every key `changeReasonKey` can answer (for the test that every one is translated). */
export const CHANGE_REASON_KEYS: readonly string[] = [...Object.values(ERROR_KEYS), `${ERROR_PREFIX}.unknown`];

/** Only a change that failed or was partly sent can be sent again (the API answers 409 for any other). */
export const canRetryChange = (change: Pick<CalendarChange, 'state'> | undefined): boolean => change?.state === 'Failed' || change?.state === 'PartiallySent';

interface PropertyLineInput {
  change: CalendarChange | undefined;
  /** The property of the change; `undefined` when the change does not list it (an answer that says nothing about it is not a success). */
  property: CalendarChangeProperty | undefined;
  read: ChangeRead;
  /** The screen has stopped asking by itself while the change is still waiting. */
  watchOver: boolean;
  /** The caller may send a failed change again (`property.write`). */
  mayRetry: boolean;
}

function line(kind: ChangeLineKind, reasonKey: string | null = null, canRetry = false): ChangeLine {
  return { kind, reasonKey, canRetry };
}

/**
 * The line of one property of a change. Every state that is not completed is said as such; nothing says more than the API did: a property the change does not list is
 * `unreadable`, never "done".
 */
export function propertyLineOf({ change, property, read, watchOver, mayRetry }: PropertyLineInput): ChangeLine {
  // A 404 is "not found", whatever an earlier read left in the cache: the query keeps its old data when a later read fails.
  if (read === 'notFound') return line('notFound');
  if (read === 'failed' || read === 'idle') return line('unreadable');
  if (read === 'loading' || !change) return line('waiting');
  if (!property) return line('unreadable');

  switch (property.state) {
    case 'Skipped':
      return line('notConnected');
    case 'Confirmed':
      return line('confirmed');
    case 'Accepted':
      // Some of the change is accepted and the rest is still on its way: it is not completed, and is said as that.
      if (isWaitingState(change.state)) return watchOver ? line('noAnswer') : line('sending', change.errorCode ? changeReasonKey(change.errorCode) : null);
      return line('accepted');
    case 'Failed':
      return line('failed', changeReasonKey(property.errorCode ?? change.errorCode), mayRetry && canRetryChange(change));
    case 'Pending':
      if (watchOver) return line('noAnswer');
      return change.state === 'Sending' ? line('sending') : line('waiting', change.errorCode ? changeReasonKey(change.errorCode) : null);
    default:
      // A state this client does not know: not completed as far as it can tell.
      return line('unreadable');
  }
}

function isWaitingState(state: CalendarChangeState): boolean {
  return state === 'Queued' || state === 'Sending';
}

/** What a change as a whole is in the compact line and in the list: counted as waiting (on its way), failed (needs a look) or neither. */
export function changeGroupOf(change: Pick<CalendarChange, 'state'>): 'waiting' | 'failed' | 'delivered' {
  if (isWaitingState(change.state)) return 'waiting';
  if (change.state === 'Failed' || change.state === 'PartiallySent') return 'failed';
  return 'delivered';
}

/** The one step the result of a change suggests, the most urgent first: a part that failed, a part that is still on its way, or the calendar to look at. */
export type ChangeNextStep = 'retry' | 'wait' | 'checkAgain' | 'calendar';

export function nextStepOfChange(change: Pick<CalendarChange, 'state' | 'properties'>, watchOver: boolean): ChangeNextStep {
  if (change.properties.some((property) => property.state === 'Failed')) return 'retry';
  if (change.state === 'Queued' || change.state === 'Sending') return watchOver ? 'checkAgain' : 'wait';
  return 'calendar';
}
