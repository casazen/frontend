import { beforeEach, describe, expect, it } from 'vitest';
import i18n from '@/i18n/config';
import type { CalendarChange, CalendarChangeProperty } from '@/types/calendar-changes.types';
import { CHANGE_REASON_KEYS, canRetryChange, changeGroupOf, changeReadOf, changeReasonKey, propertyLineOf } from './calendar-change-words';

const property = (changes: Partial<CalendarChangeProperty> = {}): CalendarChangeProperty => ({ propertyId: 'p1', state: 'Pending', chunkCount: 1, ...changes });
const change = (changes: Partial<CalendarChange> = {}): CalendarChange => ({
  id: 'c1',
  kind: 'DayRules',
  state: 'Queued',
  requestedAt: '2026-09-12T10:00:00Z',
  propertyCount: 1,
  dayCount: 3,
  quotaUnitsEstimated: 1,
  properties: [property()],
  ...changes,
});

const line = (input: { change?: CalendarChange; property?: CalendarChangeProperty; read?: 'ok' | 'loading' | 'failed' | 'notFound' | 'idle'; watchOver?: boolean; mayRetry?: boolean }) => {
  const base = input.change ?? change();
  return propertyLineOf({ change: base, property: 'property' in input ? input.property : base.properties[0], read: input.read ?? 'ok', watchOver: input.watchOver ?? false, mayRetry: input.mayRetry ?? true });
};

describe('what a change of the calendar says about itself (E08/F05/US03/T02, T03, NF-36)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
  });

  it('propertyLineOf_QueuedAndSending_AreOnTheirWay_NothingMore', () => {
    expect(line({}).kind).toBe('waiting');
    expect(line({ change: change({ state: 'Sending' }), property: property({ state: 'Pending' }) }).kind).toBe('sending');
  });

  it('propertyLineOf_Accepted_IsAcceptedAndNeverConfirmedOrPublished', () => {
    const accepted = change({ state: 'Sent', properties: [property({ state: 'Accepted' })] });
    expect(line({ change: accepted }).kind).toBe('accepted');
    expect(line({ change: change({ state: 'Confirmed', properties: [property({ state: 'Confirmed' })] }) }).kind).toBe('confirmed');
    // Some chunks accepted and the rest still to send: not completed, said as sending.
    expect(line({ change: change({ state: 'Sending', properties: [property({ state: 'Accepted' })] }) }).kind).toBe('sending');
  });

  it('propertyLineOf_AFailedProperty_HasItsReasonAndARetryOnlyWhereTheApiAllowsIt', () => {
    const failed = change({ state: 'Failed', properties: [property({ state: 'Failed', errorCode: 'octorate_unavailable' })] });
    expect(line({ change: failed })).toEqual({ kind: 'failed', reasonKey: 'booking.syncReason.unavailable', canRetry: true });
    expect(line({ change: failed, mayRetry: false }).canRetry).toBe(false);
    // A change that is waiting cannot be retried (409): the button is not offered.
    const waiting = change({ state: 'Queued', properties: [property({ state: 'Failed' })] });
    expect(line({ change: waiting }).canRetry).toBe(false);
    expect(line({ change: change({ state: 'PartiallySent', properties: [property({ state: 'Failed' })] }) }).canRetry).toBe(true);
  });

  it('propertyLineOf_ANotConnectedProperty_StaysInCasaZen', () => {
    expect(line({ change: change({ state: 'Applied', properties: [property({ state: 'Skipped', chunkCount: 0 })] }) }).kind).toBe('notConnected');
  });

  it('propertyLineOf_WaitingWhenTheScreenStoppedAsking_IsNeutralNoAnswer', () => {
    expect(line({ watchOver: true }).kind).toBe('noAnswer');
    expect(line({ change: change({ state: 'Sending', properties: [property({ state: 'Accepted' })] }), watchOver: true }).kind).toBe('noAnswer');
  });

  it('propertyLineOf_AQuotaThatWaits_SaysWhyItWaitsAndIsNoFailure', () => {
    const waiting = change({ errorCode: 'octorate_quota_low' });
    expect(line({ change: waiting })).toEqual({ kind: 'waiting', reasonKey: 'booking.calendar.change.error.quotaLow', canRetry: false });
  });

  it('propertyLineOf_AReadThatFailedOrAPropertyTheAnswerDoesNotList_IsNeverASuccess', () => {
    expect(line({ read: 'failed' }).kind).toBe('unreadable');
    expect(line({ property: undefined }).kind).toBe('unreadable');
    expect(line({ read: 'idle' }).kind).toBe('unreadable');
  });

  it('propertyLineOf_A404_IsNotFound_WhateverTheCacheHolds', () => {
    // The change is in the cache as accepted, and the last read said 404.
    const cached = change({ state: 'Sent', properties: [property({ state: 'Accepted' })] });
    expect(line({ change: cached, read: 'notFound' }).kind).toBe('notFound');
    expect(changeReadOf({ enabled: true, isError: true, notFound: true, hasData: true })).toBe('notFound');
    expect(changeReadOf({ enabled: true, isError: true, notFound: false, hasData: true })).toBe('failed');
    expect(changeReadOf({ enabled: true, isError: false, notFound: false, hasData: true })).toBe('ok');
    expect(changeReadOf({ enabled: true, isError: false, notFound: false, hasData: false })).toBe('loading');
    expect(changeReadOf({ enabled: false, isError: false, notFound: false, hasData: false })).toBe('idle');
  });

  it('changeReasonKey_AnUnknownCode_GetsTheGenericSentenceNeverTheRawCode', () => {
    expect(changeReasonKey('something_new')).toBe('booking.calendar.change.error.unknown');
    expect(changeReasonKey(undefined)).toBe('booking.calendar.change.error.unknown');
  });

  it('CHANGE_REASON_KEYS_EveryReasonIsTranslatedInBothLanguages', async () => {
    for (const language of ['it', 'en']) {
      await i18n.changeLanguage(language);
      for (const key of CHANGE_REASON_KEYS) expect(i18n.t(key), `${language} ${key}`).not.toBe(key);
    }
  });

  it('canRetryChange_OnlyFailedOrPartlySent', () => {
    expect(canRetryChange(change({ state: 'Failed' }))).toBe(true);
    expect(canRetryChange(change({ state: 'PartiallySent' }))).toBe(true);
    for (const state of ['Applied', 'Queued', 'Sending', 'Sent', 'Confirmed'] as const) expect(canRetryChange(change({ state }))).toBe(false);
  });

  it('changeGroupOf_CountsWaitingAndFailedApart', () => {
    expect(changeGroupOf(change({ state: 'Queued' }))).toBe('waiting');
    expect(changeGroupOf(change({ state: 'Sending' }))).toBe('waiting');
    expect(changeGroupOf(change({ state: 'Failed' }))).toBe('failed');
    expect(changeGroupOf(change({ state: 'PartiallySent' }))).toBe('failed');
    expect(changeGroupOf(change({ state: 'Sent' }))).toBe('delivered');
  });
});
