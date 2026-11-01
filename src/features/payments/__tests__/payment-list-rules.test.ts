import { describe, expect, it } from 'vitest';
import type { PaymentListItem } from '@/types';
import { isCanceled, isIncoming } from '../lib/payment-list';

const TODAY = '2026-11-01';

function payment(overrides: Partial<PaymentListItem> = {}): PaymentListItem {
  return {
    id: 'p-1',
    bookingId: 'b-1',
    bookingCode: 'ABCDE-FGHJK',
    propertyId: 'prop-1',
    propertyName: 'Casa Mare',
    guestName: 'Anna Verdi',
    amount: 100,
    amountCents: 10000,
    refundedAmount: 0,
    refundedAmountCents: 0,
    currency: 'EUR',
    status: 'Completed',
    method: 'CreditCard',
    description: 'Soggiorno',
    transactionId: 'tx-1',
    stripePaymentIntentId: 'pi_1',
    processedAt: '2026-10-01T10:00:00Z',
    createdAt: '2026-10-01T09:00:00Z',
    bookingCheckIn: '2026-11-03',
    bookingCheckOut: '2026-11-06',
    ...overrides,
  };
}

describe('isIncoming («In arrivo»: what is scheduled or on, not past)', () => {
  it('isIncoming_AStayThatIsComing_CountsPaidOrStillToCollect', () => {
    expect(isIncoming(payment({ status: 'Completed' }), TODAY)).toBe(true);
    expect(isIncoming(payment({ status: 'Pending', method: 'CashOnArrival', stripePaymentIntentId: null }), TODAY)).toBe(true);
    expect(isIncoming(payment({ status: 'Processing' }), TODAY)).toBe(true);
    expect(isIncoming(payment({ status: 'PartiallyRefunded', refundedAmount: 20, refundedAmountCents: 2000 }), TODAY)).toBe(true);
  });

  it('isIncoming_AStayThatEndsToday_IsStillOn', () => {
    expect(isIncoming(payment({ status: 'Pending', bookingCheckIn: '2026-10-29', bookingCheckOut: TODAY }), TODAY)).toBe(true);
  });

  it('isIncoming_AStayThatEndedYesterday_IsPast_PaidOrNot', () => {
    expect(isIncoming(payment({ status: 'Pending', bookingCheckIn: '2026-10-28', bookingCheckOut: '2026-10-31' }), TODAY)).toBe(false);
    expect(isIncoming(payment({ status: 'Completed', bookingCheckIn: '2026-10-28', bookingCheckOut: '2026-10-31' }), TODAY)).toBe(false);
  });

  it.each(['Canceled', 'Failed', 'Refunded'] as const)('isIncoming_%s_NothingIsComingEvenForAComingStay', (status) => {
    expect(isIncoming(payment({ status }), TODAY)).toBe(false);
  });

  it('isIncoming_AnApiThatSendsNoStay_KeepsOnlyWhatIsStillWaiting', () => {
    const noStay = { bookingCheckIn: undefined, bookingCheckOut: undefined };

    expect(isIncoming(payment({ ...noStay, status: 'Pending' }), TODAY)).toBe(true);
    expect(isIncoming(payment({ ...noStay, status: 'Processing' }), TODAY)).toBe(true);
    expect(isIncoming(payment({ ...noStay, status: 'Completed' }), TODAY)).toBe(false);
    expect(isIncoming(payment({ bookingCheckIn: null, bookingCheckOut: null, status: 'Pending' }), TODAY)).toBe(true);
  });

  it('isIncoming_ADayThatIsNotADate_IsAsIfTheStayWasNotSent', () => {
    expect(isIncoming(payment({ status: 'Pending', bookingCheckOut: 'domani' }), TODAY)).toBe(true);
    expect(isIncoming(payment({ status: 'Completed', bookingCheckOut: 'domani' }), TODAY)).toBe(false);
  });
});

describe('isCanceled', () => {
  it('isCanceled_OnlyAPaymentCanceledWithItsBooking', () => {
    expect(isCanceled(payment({ status: 'Canceled' }))).toBe(true);
    expect(isCanceled(payment({ status: 'Failed' }))).toBe(false);
    expect(isCanceled(payment({ status: 'Refunded' }))).toBe(false);
  });
});
