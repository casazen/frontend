import { describe, expect, it } from 'vitest';
import itLocale from '@/i18n/locales/it.json';
import enLocale from '@/i18n/locales/en.json';
import type { MirrorLine } from '@/features/bookings/lib/new-booking-result';
import type { BookingOctorateSync } from '@/types';
import type { AlloggiatiStatusDto } from '@/types/alloggiati.types';
import type { CheckoutWizardState } from '@/types/compliance.types';
import { CHANNEL_MANAGER_TEXT_KEYS, NEXT_STEP_KEYS, alloggiatiNow, checkoutNextStepOf, syncAfterCheckout } from '../lib/checkout-result';

const CLOSED_AT = '2026-09-24T10:00:00Z';

function sync(changes: Partial<BookingOctorateSync> = {}): BookingOctorateSync {
  return { state: 'Synced', lastOperation: 'Update', lastSyncedAt: '2026-09-24T10:05:00Z', errorCode: null, canRetry: false, ...changes };
}

function line(kind: MirrorLine['kind'], canRetry = false): MirrorLine {
  return { kind, reasonKey: null, canRetry };
}

const valueOf = (locale: unknown, key: string): unknown =>
  key.split('.').reduce<unknown>((node, part) => (node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined), locale);
const hasKey = (locale: unknown, key: string): boolean => typeof valueOf(locale, key) === 'string';

describe('syncAfterCheckout', () => {
  it('syncAfterCheckout_NoMirror_StaysWithoutOne', () => {
    expect(syncAfterCheckout(null, CLOSED_AT)).toBeNull();
    expect(syncAfterCheckout(undefined, CLOSED_AT)).toBeUndefined();
  });

  it('syncAfterCheckout_ConfirmedAfterTheStayWasClosed_IsTheCheckOutsOwn', () => {
    expect(syncAfterCheckout(sync({ lastSyncedAt: '2026-09-24T10:00:01Z' }), CLOSED_AT)?.state).toBe('Synced');
  });

  it('syncAfterCheckout_ConfirmedBeforeTheStayWasClosed_IsStillOnItsWay', () => {
    expect(syncAfterCheckout(sync({ lastSyncedAt: '2026-09-24T09:59:59Z' }), CLOSED_AT)?.state).toBe('Pending');
  });

  it('syncAfterCheckout_SyncedWithoutAConfirmationTime_IsNotTakenAsConfirmed', () => {
    expect(syncAfterCheckout(sync({ lastSyncedAt: null }), CLOSED_AT)?.state).toBe('Pending');
  });

  it('syncAfterCheckout_NoClosingTimeToCompareWith_TakesTheSyncAsItIs', () => {
    expect(syncAfterCheckout(sync({ lastSyncedAt: '2020-01-01T00:00:00Z' }), null)?.state).toBe('Synced');
  });

  it.each(['Pending', 'Failed', 'Conflict', 'NotAllowedByChannel'] as const)('syncAfterCheckout_%s_IsLeftAlone', (state) => {
    expect(syncAfterCheckout(sync({ state, lastSyncedAt: '2020-01-01T00:00:00Z' }), CLOSED_AT)?.state).toBe(state);
  });
});

describe('alloggiatiNow', () => {
  const fromWizard: CheckoutWizardState['alloggiati'] = {
    status: 'DaInviareManualmente',
    sent: false,
    deadlineAt: '2026-09-22T22:00:00Z',
    isOverdue: false,
    dataComplete: false,
  };

  it('alloggiatiNow_NothingReadYet_KeepsTheWizardsOwn', () => {
    expect(alloggiatiNow(fromWizard, undefined)).toBe(fromWizard);
  });

  it('alloggiatiNow_AnAnswerThatIsNotAStatus_KeepsTheWizardsOwn', () => {
    expect(alloggiatiNow(fromWizard, { dataComplete: true } as AlloggiatiStatusDto)).toBe(fromWizard);
  });

  it('alloggiatiNow_TheServerHoldsMoreNow_ShowsWhatTheServerHolds', () => {
    const live = { bookingId: 'b-1', status: 'InviatoManualmente', dataComplete: true, deadlineAt: '2026-09-22T22:00:00Z', isOverdue: false } as AlloggiatiStatusDto;

    expect(alloggiatiNow(fromWizard, live)).toEqual({ status: 'InviatoManualmente', sent: true, deadlineAt: '2026-09-22T22:00:00Z', isOverdue: false, dataComplete: true });
  });

  it('alloggiatiNow_ReceiptStillPending_IsNotSentYet', () => {
    const live = { bookingId: 'b-1', status: 'SentReceiptPending', dataComplete: true, deadlineAt: '2026-09-22T22:00:00Z', isOverdue: false } as AlloggiatiStatusDto;

    expect(alloggiatiNow(fromWizard, live).sent).toBe(false);
  });
});

describe('checkoutNextStepOf', () => {
  const done = { alloggiatiSent: true, propertyReady: true };

  it('checkoutNextStepOf_ChannelManagerFailedAndRetryOffered_IsToRetry', () => {
    expect(checkoutNextStepOf({ ...done, mirror: line('failed', true) })).toBe('retryChannelManager');
    expect(checkoutNextStepOf({ ...done, mirror: line('conflict', true) })).toBe('retryChannelManager');
  });

  it.each(['failed', 'conflict', 'datesTaken', 'blocked', 'waiting', 'unreadable', 'notFound'] as const)(
    'checkoutNextStepOf_ChannelManager%sWithoutRetry_IsToCheckIt',
    (kind) => {
      expect(checkoutNextStepOf({ ...done, mirror: line(kind) })).toBe('checkChannelManager');
    },
  );

  it('checkoutNextStepOf_CheckOutStillOnItsWay_IsNotUrgent', () => {
    expect(checkoutNextStepOf({ ...done, mirror: line('pending') })).toBe('nothing');
    expect(checkoutNextStepOf({ ...done, mirror: line('synced') })).toBe('nothing');
  });

  it('checkoutNextStepOf_AlloggiatiBeforeThePropertyReady', () => {
    expect(checkoutNextStepOf({ mirror: null, alloggiatiSent: false, propertyReady: false })).toBe('sendAlloggiati');
    expect(checkoutNextStepOf({ mirror: null, alloggiatiSent: true, propertyReady: false })).toBe('markReady');
  });

  it('checkoutNextStepOf_ChannelManagerBeforeAlloggiati', () => {
    expect(checkoutNextStepOf({ mirror: line('failed', true), alloggiatiSent: false, propertyReady: false })).toBe('retryChannelManager');
  });

  it('checkoutNextStepOf_NothingLeft_SaysSo', () => {
    expect(checkoutNextStepOf({ mirror: null, ...done })).toBe('nothing');
  });
});

describe('words of the result', () => {
  const keys = [...Object.values(NEXT_STEP_KEYS), ...CHANNEL_MANAGER_TEXT_KEYS];

  it.each(keys)('%s_ExistsInItalianAndEnglish', (key) => {
    expect(hasKey(itLocale, key)).toBe(true);
    expect(hasKey(enLocale, key)).toBe(true);
  });

  it('theChannelManagerWords_NeverNameTheSupplierOfTheConnection', () => {
    const texts = keys.flatMap((key) => [valueOf(itLocale, key), valueOf(enLocale, key)]);

    expect(texts.every((text) => typeof text === 'string')).toBe(true);
    expect(texts.join(' ')).not.toMatch(/octorate/i);
  });
});
