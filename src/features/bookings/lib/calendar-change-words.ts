import type { CalendarChange, CalendarChangeProperty, CalendarChangeState } from '@/types/calendar-changes.types';

/**
 * What a change of the calendar says about itself, in plain words and with the same vocabulary wherever it is told (the panel of the days, the result of the bulk wizard, the
 * line above the calendar and its list). Nothing is worded as "published": the channel manager accepting a change is "accepted by your channel manager", which is not the
 * change being on the portals; every state that is not completed is said as such, and an answer that could not be read is never taken for a success.
 */

export type ChangeRead = 'idle' | 'loading' | 'ok' | 'notFound' | 'failed';

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
  reasonKey: string | null;
  canRetry: boolean;
}

const ERROR_PREFIX = 'booking.calendar.change.error';

/**
 * The words of each stable code of a change, written out so that a missing translation is found by a test. The reasons that the push of a booking already words (the
 * sentences under booking.syncReason, used by the booking pages of the channel manager) are not worded twice: the room not chosen, the channel manager that did not
 * answer and the one that refused.
 */
const ERROR_KEYS: Readonly<Record<string, string>> = {
  octorate_room_not_chosen: 'booking.syncReason.roomNotChosen',
  octorate_room_not_licensed: `${ERROR_PREFIX}.roomNotLicensed`,
  octorate_quota_low: `${ERROR_PREFIX}.quotaLow`,
  octorate_unavailable: 'booking.syncReason.unavailable',
  octorate_not_authorized: `${ERROR_PREFIX}.notAuthorized`,
  octorate_channel_error: `${ERROR_PREFIX}.channelError`,
  octorate_request_rejected: 'booking.syncReason.rejected',
};

export function changeReasonKey(code: string | null | undefined): string {
  return (code ? ERROR_KEYS[code] : undefined) ?? `${ERROR_PREFIX}.unknown`;
}

export const CHANGE_REASON_KEYS: readonly string[] = [...Object.values(ERROR_KEYS), `${ERROR_PREFIX}.unknown`];

export const canRetryChange = (change: Pick<CalendarChange, 'state'> | undefined): boolean => change?.state === 'Failed' || change?.state === 'PartiallySent';

interface PropertyLineInput {
  change: CalendarChange | undefined;
  property: CalendarChangeProperty | undefined;
  read: ChangeRead;
  watchOver: boolean;
  mayRetry: boolean;
}

function line(kind: ChangeLineKind, reasonKey: string | null = null, canRetry = false): ChangeLine {
  return { kind, reasonKey, canRetry };
}

export function propertyLineOf({ change, property, read, watchOver, mayRetry }: PropertyLineInput): ChangeLine {
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
      if (isWaitingState(change.state)) return watchOver ? line('noAnswer') : line('sending', change.errorCode ? changeReasonKey(change.errorCode) : null);
      return line('accepted');
    case 'Failed':
      return line('failed', changeReasonKey(property.errorCode ?? change.errorCode), mayRetry && canRetryChange(change));
    case 'Pending':
      if (watchOver) return line('noAnswer');
      return change.state === 'Sending' ? line('sending') : line('waiting', change.errorCode ? changeReasonKey(change.errorCode) : null);
    default:
      return line('unreadable');
  }
}

function isWaitingState(state: CalendarChangeState): boolean {
  return state === 'Queued' || state === 'Sending';
}

export function changeGroupOf(change: Pick<CalendarChange, 'state'>): 'waiting' | 'failed' | 'delivered' {
  if (isWaitingState(change.state)) return 'waiting';
  if (change.state === 'Failed' || change.state === 'PartiallySent') return 'failed';
  return 'delivered';
}

export type ChangeNextStep = 'retry' | 'wait' | 'checkAgain' | 'calendar';

export function nextStepOfChange(change: Pick<CalendarChange, 'state' | 'properties'>, watchOver: boolean): ChangeNextStep {
  if (change.properties.some((property) => property.state === 'Failed')) return 'retry';
  if (change.state === 'Queued' || change.state === 'Sending') return watchOver ? 'checkAgain' : 'wait';
  return 'calendar';
}
