import { describe, expect, it } from 'vitest';
import i18n from '@/i18n/config';
import type { BookingOctorateSync } from '@/types';
import {
  SYNC_REASON_KEYS,
  mirrorLineOf,
  mirrorReadOf,
  nextStepOf,
  paymentLineOf,
  shouldWatchMirror,
  syncReasonKey,
  type MirrorLine,
} from './new-booking-result';

function sync(changes: Partial<BookingOctorateSync> = {}): BookingOctorateSync {
  return { state: 'Synced', lastOperation: 'Create', lastSyncedAt: null, errorCode: null, canRetry: false, ...changes };
}

const open = { expected: true, read: 'ok', watchOver: false, retrying: false } as const;

describe('the line of the channel manager', () => {
  it('mirrorLineOf_PropertyNotConnected_HasNoLineAtAll', () => {
    // Nothing is said about a connection that is not there: a read that finds no mirror on a property that is not mirrored is no line.
    expect(mirrorLineOf({ ...open, expected: false, sync: null })).toBeNull();
    expect(mirrorLineOf({ ...open, expected: null, sync: null })).toBeNull();
    expect(mirrorLineOf({ ...open, expected: false, read: 'idle', sync: undefined })).toBeNull();
  });

  it('mirrorLineOf_MirroredPropertyBeforeTheFirstRowExists_IsBeingSent', () => {
    expect(mirrorLineOf({ ...open, sync: null, read: 'loading' })?.kind).toBe('pending');
    expect(mirrorLineOf({ ...open, sync: null })?.kind).toBe('pending');
  });

  it.each([
    ['Pending', 'pending'],
    ['Synced', 'synced'],
  ] as const)('mirrorLineOf_State_%s_Is_%s', (state, kind) => {
    expect(mirrorLineOf({ ...open, sync: sync({ state }) })?.kind).toBe(kind);
  });

  it('mirrorLineOf_Failed_SaysWhyInPlainWordsAndOffersRetryOnlyWhenTheApiDoes', () => {
    const failed = mirrorLineOf({ ...open, sync: sync({ state: 'Failed', errorCode: 'octorate_dates_unavailable', canRetry: true }) });
    const readOnly = mirrorLineOf({ ...open, sync: sync({ state: 'Failed', errorCode: 'octorate_dates_unavailable', canRetry: false }) });

    expect(failed).toEqual({ kind: 'failed', reasonKey: 'booking.create.done.channelManager.reasons.datesUnavailable', canRetry: true });
    expect(readOnly?.canRetry).toBe(false);
  });

  it('mirrorLineOf_Conflict_IsNotSuccessAndKeepsItsRetry', () => {
    const line = mirrorLineOf({ ...open, sync: sync({ state: 'Conflict', errorCode: null, canRetry: true }) });

    expect(line?.kind).toBe('conflict');
    expect(line?.reasonKey).toBe('booking.create.done.channelManager.reasons.reservationChanged');
    expect(line?.canRetry).toBe(true);
  });

  it('mirrorLineOf_NotAllowedByChannel_IsNotCompletedAndCannotBeRetried', () => {
    expect(mirrorLineOf({ ...open, sync: sync({ state: 'NotAllowedByChannel' }) })).toMatchObject({ kind: 'blocked', canRetry: false });
  });

  it('mirrorLineOf_AStateThisClientDoesNotKnow_IsNotCompletedEither', () => {
    const unknown = { ...sync(), state: 'Archived' } as unknown as BookingOctorateSync;

    expect(mirrorLineOf({ ...open, sync: unknown })?.kind).toBe('waiting');
  });

  it('mirrorLineOf_RetryAccepted_SaysBeingSentWhileTheRowStillHoldsTheOldState', () => {
    // The row keeps its state until the push really starts: believing it would show the failure again for a moment after «Retry».
    const failed = sync({ state: 'Failed', errorCode: 'octorate_unavailable', canRetry: true });

    expect(mirrorLineOf({ ...open, sync: failed, retrying: true })?.kind).toBe('pending');
    expect(mirrorLineOf({ ...open, sync: failed, retrying: false })?.kind).toBe('failed');
  });

  it('mirrorLineOf_RetryAccepted_NeverHidesASuccess', () => {
    expect(mirrorLineOf({ ...open, sync: sync({ state: 'Synced' }), retrying: true })?.kind).toBe('synced');
  });

  it('mirrorLineOf_NoAnswerInTheTimeTheResultWaits_IsNotACompletedState', () => {
    expect(mirrorLineOf({ ...open, sync: null, watchOver: true })?.kind).toBe('waiting');
  });

  it('mirrorLineOf_StillBeingSentWhenTheResultStoppedFollowingIt_SaysNoAnswerHasComeInsteadOfClaimingItIsOnItsWay', () => {
    // The last read said "being sent" a minute and a half ago and nobody asks any more: the line must not go on saying it as if it knew.
    expect(mirrorLineOf({ ...open, sync: sync({ state: 'Pending' }), watchOver: false })?.kind).toBe('pending');
    expect(mirrorLineOf({ ...open, sync: sync({ state: 'Pending' }), watchOver: true })?.kind).toBe('waiting');
  });

  it('mirrorLineOf_TimeOverDoesNotHideASettledState', () => {
    expect(mirrorLineOf({ ...open, sync: sync({ state: 'Synced' }), watchOver: true })?.kind).toBe('synced');
    expect(mirrorLineOf({ ...open, sync: sync({ state: 'Failed', canRetry: true }), watchOver: true })?.kind).toBe('failed');
  });

  it('mirrorLineOf_TheReadFailedAndThereIsNoMirror_SaysItCannotRead', () => {
    expect(mirrorLineOf({ ...open, sync: undefined, read: 'failed' })?.kind).toBe('unreadable');
  });

  it('mirrorLineOf_NotFound_IsNotFoundWhateverTheCacheStillHolds', () => {
    // A query keeps its old data when a later read fails: a 404 must not show the state of the booking it used to be.
    expect(mirrorLineOf({ ...open, sync: sync({ state: 'Synced' }), read: 'notFound' })?.kind).toBe('notFound');
    expect(mirrorLineOf({ ...open, sync: sync({ state: 'Pending' }), read: 'notFound' })?.kind).toBe('notFound');
  });
});

describe('the read of the booking', () => {
  it('mirrorReadOf_NotAsked_IsIdle', () => {
    expect(mirrorReadOf({ enabled: false, isError: true, notFound: true, hasData: true })).toBe('idle');
  });

  it('mirrorReadOf_404WithDataInTheCache_IsNotFound', () => {
    expect(mirrorReadOf({ enabled: true, isError: true, notFound: true, hasData: true })).toBe('notFound');
  });

  it('mirrorReadOf_OtherErrorWithDataInTheCache_IsFailed', () => {
    expect(mirrorReadOf({ enabled: true, isError: true, notFound: false, hasData: true })).toBe('failed');
  });

  it('mirrorReadOf_DataAndNoError_IsOk_NoDataYet_IsLoading', () => {
    expect(mirrorReadOf({ enabled: true, isError: false, notFound: false, hasData: true })).toBe('ok');
    expect(mirrorReadOf({ enabled: true, isError: false, notFound: false, hasData: false })).toBe('loading');
  });
});

describe('when the result keeps asking', () => {
  const watch = { expected: true, watchOver: false, retrying: false };

  it('shouldWatchMirror_BeingSent_KeepsAsking', () => {
    expect(shouldWatchMirror({ ...watch, sync: sync({ state: 'Pending' }) })).toBe(true);
  });

  it('shouldWatchMirror_MirroredPropertyWithNoRowYet_KeepsAsking', () => {
    expect(shouldWatchMirror({ ...watch, sync: null })).toBe(true);
  });

  it('shouldWatchMirror_PropertyNotConnected_NeverAsks', () => {
    expect(shouldWatchMirror({ ...watch, expected: false, sync: null })).toBe(false);
  });

  it('shouldWatchMirror_PropertyOfWhichNothingIsKnownAndNoRowYet_KeepsAskingWhileTheTimeIsNotOver', () => {
    // The push writes the row a moment after the booking: a read made before it finds none, which is no answer for a property not known to be unconnected.
    expect(shouldWatchMirror({ ...watch, expected: null, sync: null })).toBe(true);
    expect(shouldWatchMirror({ ...watch, expected: null, sync: undefined })).toBe(true);
    expect(shouldWatchMirror({ ...watch, expected: null, sync: null, watchOver: true })).toBe(false);
  });

  it('mirrorLineOf_PropertyOfWhichNothingIsKnownAndNoRowYet_HasNoLineWhileItAsks', () => {
    // Asking is not saying: with no row and nothing known there is no line to show, as before.
    expect(mirrorLineOf({ ...open, expected: null, sync: null })).toBeNull();
    expect(mirrorLineOf({ ...open, expected: null, sync: null, watchOver: true })).toBeNull();
  });

  it.each(['Synced', 'Failed', 'Conflict', 'NotAllowedByChannel'] as const)('shouldWatchMirror_State_%s_IsSettledAndStopsAsking', (state) => {
    expect(shouldWatchMirror({ ...watch, sync: sync({ state }) })).toBe(false);
  });

  it('shouldWatchMirror_AfterRetry_AsksWhileTheRowStillHoldsTheFailure', () => {
    expect(shouldWatchMirror({ ...watch, retrying: true, sync: sync({ state: 'Failed' }) })).toBe(true);
    expect(shouldWatchMirror({ ...watch, retrying: true, sync: sync({ state: 'Conflict' }) })).toBe(true);
    expect(shouldWatchMirror({ ...watch, retrying: true, sync: sync({ state: 'Synced' }) })).toBe(false);
  });

  it('shouldWatchMirror_TheTimeIsOver_StopsEvenWhileBeingSent', () => {
    expect(shouldWatchMirror({ ...watch, watchOver: true, sync: sync({ state: 'Pending' }) })).toBe(false);
    expect(shouldWatchMirror({ ...watch, watchOver: true, sync: null })).toBe(false);
  });
});

describe('the reasons', () => {
  it('syncReasonKey_CodeOfTheApi_IsItsOwnReason', () => {
    expect(syncReasonKey('octorate_rejected')).toBe('booking.create.done.channelManager.reasons.rejected');
  });

  it.each([null, undefined, '', 'something_new_of_a_newer_api'])('syncReasonKey_%s_IsTheGenericReasonAndNeverTheRawCode', (code) => {
    expect(syncReasonKey(code)).toBe('booking.create.done.channelManager.reasons.unknown');
  });

  it.each(SYNC_REASON_KEYS)('syncReasonKey_%s_IsTranslatedInBothLanguages', (key) => {
    for (const lng of ['it', 'en']) {
      expect(i18n.exists(key, { lng })).toBe(true);
      expect(i18n.t(key, { lng })).not.toBe(key);
    }
  });

  it('syncReasonKey_NeverNamesTheSupplierOfTheChannelManager', () => {
    for (const key of SYNC_REASON_KEYS) {
      for (const lng of ['it', 'en']) expect(i18n.t(key, { lng })).not.toMatch(/octorate/i);
    }
  });
});

describe('how the guest pays, as the result tells it', () => {
  it.each([
    [{ arrangement: 'paymentLink', portal: false, hasLink: true }, 'linkSent'],
    [{ arrangement: 'paymentLink', portal: false, hasLink: false }, 'linkMissing'],
    [{ arrangement: 'onSite', portal: false, hasLink: false }, 'onSite'],
    [{ arrangement: 'bankTransfer', portal: false, hasLink: false }, 'bankTransfer'],
    [{ arrangement: '', portal: false, hasLink: false }, 'none'],
    // The portal collects whatever was chosen before the reservation was linked.
    [{ arrangement: 'paymentLink', portal: true, hasLink: true }, 'portal'],
  ] as const)('paymentLineOf_%j_Is_%s', (input, expected) => {
    expect(paymentLineOf(input)).toBe(expected);
  });
});

describe('the one next step', () => {
  const line = (kind: MirrorLine['kind'], canRetry = false): MirrorLine => ({ kind, reasonKey: null, canRetry });

  it('nextStepOf_ChannelManagerFailedAndRetryOpen_IsToRetryItBeforeAnythingElse', () => {
    expect(nextStepOf(line('failed', true), 'linkMissing')).toBe('retryChannelManager');
    expect(nextStepOf(line('conflict', true), 'onSite')).toBe('retryChannelManager');
  });

  it('nextStepOf_ChannelManagerFailedAndNoRetry_IsToCheckIt', () => {
    expect(nextStepOf(line('failed', false), 'onSite')).toBe('checkChannelManager');
    expect(nextStepOf(line('waiting'), 'onSite')).toBe('checkChannelManager');
    expect(nextStepOf(line('unreadable'), 'onSite')).toBe('checkChannelManager');
    expect(nextStepOf(line('notFound'), 'onSite')).toBe('checkChannelManager');
    expect(nextStepOf(line('blocked'), 'onSite')).toBe('checkChannelManager');
  });

  it('nextStepOf_LinkThatWasNotMade_IsToSendIt', () => {
    expect(nextStepOf(line('synced'), 'linkMissing')).toBe('sendPaymentLink');
    expect(nextStepOf(null, 'linkMissing')).toBe('sendPaymentLink');
  });

  it('nextStepOf_PaymentByHand_IsToRecordTheIncome', () => {
    expect(nextStepOf(null, 'onSite')).toBe('recordIncome');
    expect(nextStepOf(line('pending'), 'bankTransfer')).toBe('recordIncome');
  });

  it('nextStepOf_NothingToDo_IsTheCheckInOfTheGuest', () => {
    expect(nextStepOf(null, 'linkSent')).toBe('checkIn');
    expect(nextStepOf(line('synced'), 'portal')).toBe('checkIn');
  });
});
