import { describe, expect, it } from 'vitest';
import itLocale from '@/i18n/locales/it.json';
import enLocale from '@/i18n/locales/en.json';
import type { BookingOctorateSync } from '@/types';
import type { AlloggiatiStatusDto } from '@/types/alloggiati.types';
import type { CheckoutWizardCompleteResult, CheckoutWizardState } from '@/types/compliance.types';
import {
  CHANNEL_MANAGER_LINE_KEY,
  NEXT_STEP_KEYS,
  alloggiatiNow,
  channelManagerLinked,
  checkoutNextStepOf,
  checkoutResultLines,
} from '../lib/checkout-result';

function sync(changes: Partial<BookingOctorateSync> = {}): BookingOctorateSync {
  return { state: 'Synced', lastOperation: 'Create', lastSyncedAt: '2026-09-20T08:00:00Z', errorCode: null, canRetry: false, ...changes };
}

const valueOf = (locale: unknown, key: string): unknown =>
  key.split('.').reduce<unknown>((node, part) => (node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined), locale);
const hasKey = (locale: unknown, key: string): boolean => typeof valueOf(locale, key) === 'string';

describe('channelManagerLinked', () => {
  it('channelManagerLinked_NoMirror_IsNotOnTheChannelManager', () => {
    expect(channelManagerLinked(null)).toBe(false);
    expect(channelManagerLinked(undefined)).toBe(false);
  });

  it('channelManagerLinked_TheChannelManagerConfirmedAnOperation_IsOnIt', () => {
    expect(channelManagerLinked(sync({ lastOperation: 'Create' }))).toBe(true);
    expect(channelManagerLinked(sync({ lastOperation: 'Update', lastSyncedAt: '2026-09-23T10:00:00Z' }))).toBe(true);
  });

  it.each(['Pending', 'Failed', 'Conflict', 'NotAllowedByChannel'] as const)(
    'channelManagerLinked_%s_MayMeanThereIsNoReservationSoNothingIsSaid',
    (state) => {
      expect(channelManagerLinked(sync({ state, errorCode: 'octorate_unavailable', canRetry: true }))).toBe(false);
    },
  );
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

describe('checkoutResultLines', () => {
  const closed = {
    propertyReady: true,
    bookingStatus: 'CheckedOut',
    serviceRequestId: null,
    wizard: {
      alloggiati: { status: 'InviatoManualmente', sent: true, deadlineAt: '2026-09-22T22:00:00Z', isOverdue: false, dataComplete: true },
      cleaning: { choice: 'Skip' },
      touristTax: { collection: 'CollectedAtProperty' },
    },
  } as unknown as CheckoutWizardCompleteResult;
  const key = (text: string) => text;

  it('checkoutResultLines_BookingNotOnTheChannelManager_HasNoLineForIt', () => {
    const lines = checkoutResultLines(closed, false, key);

    expect(lines.map((line) => line.element)).toEqual(['departure', 'alloggiati', 'cleaning', 'touristTax', 'propertyReady']);
  });

  it('checkoutResultLines_BookingOnTheChannelManager_HasOneNeutralLineThatIsNeverDone', () => {
    const lines = checkoutResultLines(closed, true, key);

    expect(lines.map((line) => line.element)).toEqual(['departure', 'channelManager', 'alloggiati', 'cleaning', 'touristTax', 'propertyReady']);
    // The same words and the same tone whatever the mirror of the booking says: the result has no state of the channel manager to tell.
    expect(lines[1]).toEqual({ element: 'channelManager', tone: 'attention', text: CHANNEL_MANAGER_LINE_KEY });
  });
});

describe('checkoutNextStepOf', () => {
  it('checkoutNextStepOf_AlloggiatiBeforeThePropertyReady', () => {
    expect(checkoutNextStepOf({ alloggiatiSent: false, propertyReady: false })).toBe('sendAlloggiati');
    expect(checkoutNextStepOf({ alloggiatiSent: true, propertyReady: false })).toBe('markReady');
  });

  it('checkoutNextStepOf_NothingLeft_SaysSo', () => {
    expect(checkoutNextStepOf({ alloggiatiSent: true, propertyReady: true })).toBe('nothing');
  });

  it('checkoutNextStepOf_NeverSendsTheHostToTheChannelManager', () => {
    const steps = [true, false].flatMap((alloggiatiSent) => [true, false].map((propertyReady) => checkoutNextStepOf({ alloggiatiSent, propertyReady })));

    expect(new Set(steps)).toEqual(new Set(['sendAlloggiati', 'markReady', 'nothing']));
    expect(Object.keys(NEXT_STEP_KEYS).sort()).toEqual(['markReady', 'nothing', 'sendAlloggiati']);
    expect(Object.values(NEXT_STEP_KEYS).flatMap((next) => [valueOf(itLocale, next), valueOf(enLocale, next)]).join(' ')).not.toMatch(/channel manager/i);
  });
});

describe('words of the result', () => {
  const keys = [...Object.values(NEXT_STEP_KEYS), CHANNEL_MANAGER_LINE_KEY];

  it.each(keys)('%s_ExistsInItalianAndEnglish', (key) => {
    expect(hasKey(itLocale, key)).toBe(true);
    expect(hasKey(enLocale, key)).toBe(true);
  });

  it('theChannelManagerWords_NeverNameTheSupplierOfTheConnection', () => {
    const texts = keys.flatMap((key) => [valueOf(itLocale, key), valueOf(enLocale, key)]);

    expect(texts.every((text) => typeof text === 'string')).toBe(true);
    expect(texts.join(' ')).not.toMatch(/octorate/i);
  });

  it('theChannelManagerBlock_HoldsTheOneNeutralLineAndNoStateOfTheChannelManager', () => {
    // No «being sent», «sent», «failed», «conflict», «Retry now» or «Check again»: the result tells no state of the channel manager.
    for (const locale of [itLocale, enLocale]) {
      expect(Object.keys(valueOf(locale, 'compliance.checkout.done.channelManager') as Record<string, unknown>)).toEqual(['automatic']);
    }
  });
});
