import { describe, expect, it } from 'vitest';
import i18n from '@/i18n/config';
import type { BookingOctorateSync } from '@/types';
import { SYNC_POLL_MS, SYNC_WATCH_MS, syncPollInterval, syncReasonKey, syncRetriesByItself } from './octorate-sync';

const sync = (state: BookingOctorateSync['state']): BookingOctorateSync => ({
  state,
  lastOperation: 'Update',
  lastSyncedAt: null,
  errorCode: null,
  canRetry: false,
});

const OPENED = 1_000_000;

describe('syncPollInterval', () => {
  it('syncPollInterval_PushUnderWay_AsksAgainEveryFewSeconds', () => {
    expect(syncPollInterval(sync('Pending'), { openedAt: OPENED, askedAt: null }, OPENED + 5_000)).toBe(SYNC_POLL_MS);
  });

  it('syncPollInterval_PushStillUnderWayAfterTheFirstMinute_AsksAgainMoreSlowly', () => {
    const interval = syncPollInterval(sync('Pending'), { openedAt: OPENED, askedAt: null }, OPENED + SYNC_WATCH_MS + 1);
    expect(interval).not.toBe(false);
    expect(interval).toBeGreaterThan(SYNC_POLL_MS);
  });

  it('syncPollInterval_HostJustAsked_AsksAgainEvenThoughTheRowHasNotMoved', () => {
    // The row keeps what it said until the push starts: after a save or "Retry now" a page that stopped on `Failed` or `Synced` would show an old state for good.
    const watch = { openedAt: OPENED, askedAt: OPENED + 10_000 };
    expect(syncPollInterval(sync('Failed'), watch, OPENED + 20_000)).toBe(SYNC_POLL_MS);
    expect(syncPollInterval(sync('Synced'), watch, OPENED + 20_000)).toBe(SYNC_POLL_MS);
    expect(syncPollInterval(null, watch, OPENED + 20_000)).toBe(SYNC_POLL_MS);
  });

  it('syncPollInterval_TheMinuteAfterTheAskingIsOver_StopsOnAFinalState', () => {
    const watch = { openedAt: OPENED, askedAt: OPENED + 10_000 };
    expect(syncPollInterval(sync('Failed'), watch, OPENED + 10_000 + SYNC_WATCH_MS)).toBe(false);
    expect(syncPollInterval(sync('Conflict'), watch, OPENED + 10_000 + SYNC_WATCH_MS)).toBe(false);
  });

  it.each(['Synced', 'Failed', 'Conflict', 'NotAllowedByChannel'] as const)('syncPollInterval_NothingAsked_DoesNotPoll_%s', (state) => {
    expect(syncPollInterval(sync(state), { openedAt: OPENED, askedAt: null }, OPENED + 1_000)).toBe(false);
  });

  it('syncPollInterval_BookingNotMirrored_DoesNotPollUnlessAsked', () => {
    expect(syncPollInterval(null, { openedAt: OPENED, askedAt: null }, OPENED + 1_000)).toBe(false);
  });
});

describe('syncReasonKey', () => {
  const CODES = [
    'octorate_dates_unavailable',
    'octorate_unavailable',
    'octorate_rejected',
    'octorate_reservation_changed',
    'octorate_room_not_chosen',
    'octorate_payments_not_recorded',
    'octorate_reservation_linked_elsewhere',
    'octorate_not_mirrored',
  ];

  it.each(['it', 'en'])('syncReasonKey_EveryCodeOfTheApi_HasASentenceInBothLanguages_%s', async (language) => {
    await i18n.changeLanguage(language);
    const keys = [...CODES, null, 'a_code_nobody_knows'].map(syncReasonKey);
    for (const key of keys) {
      expect(i18n.exists(key, { lng: language }), key).toBe(true);
    }
    // Every known code has a sentence of its own, and an unknown one the generic.
    expect(new Set(CODES.map(syncReasonKey)).size).toBe(CODES.length);
    expect(syncReasonKey('a_code_nobody_knows')).toBe('booking.syncReason.unknown');
    expect(syncReasonKey(null)).toBe('booking.syncReason.unknown');
  });
});

describe('syncRetriesByItself', () => {
  it('syncRetriesByItself_TheServerDeliversThePushAgain_IsTrueForNoAnswerOnly', () => {
    expect(syncRetriesByItself('octorate_unavailable')).toBe(true);
  });

  // A payment the channel manager refused to record is left to the host (only one that failed for want of an answer is delivered again, and the row cannot tell which).
  it.each(['octorate_rejected', 'octorate_dates_unavailable', 'octorate_not_mirrored', 'octorate_payments_not_recorded', null, undefined])(
    'syncRetriesByItself_WaitsForTheHost_%s',
    (code) => {
      expect(syncRetriesByItself(code)).toBe(false);
    },
  );
});
