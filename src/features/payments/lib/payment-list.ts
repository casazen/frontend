import { addDays, endOfMonth, isStayDate, romeDateOf, startOfMonth } from '@/lib/stay-dates';
import type { PaymentListItem, PaymentStatus } from '@/types';

export const PAYMENTS_PATH = '/app/short-rent/payments';

export const paymentPath = (payment: Pick<PaymentListItem, 'id'>) => `${PAYMENTS_PATH}/${payment.id}`;

const COLLECTED: readonly PaymentStatus[] = ['Completed', 'PartiallyRefunded'];
const WAITING: readonly PaymentStatus[] = ['Pending', 'Processing'];
const GIVEN_BACK: readonly PaymentStatus[] = ['Refunded', 'PartiallyRefunded'];
const NOTHING_COMING: readonly PaymentStatus[] = ['Canceled', 'Failed', 'Refunded'];

/**
 * A row only the host can collect (SR-06b): `Pending`, and neither a Stripe intent nor a transaction id. It is the "pay at the
 * property" row of an on-site booking, or a record the old form left `Pending` for good; recording the payment on its booking
 * closes it (the same rule as the backend, `ManualPaymentService`).
 */
export const isWaitingForTheHost = (payment: PaymentListItem) =>
  payment.status === 'Pending' && !payment.stripePaymentIntentId && !payment.transactionId;

export const isCollected = (payment: PaymentListItem) => COLLECTED.includes(payment.status);
export const isWaiting = (payment: PaymentListItem) => WAITING.includes(payment.status);
export const isGivenBack = (payment: PaymentListItem) => GIVEN_BACK.includes(payment.status);
export const isCanceled = (payment: PaymentListItem) => payment.status === 'Canceled';

export function isIncoming(payment: PaymentListItem, today: string): boolean {
  if (NOTHING_COMING.includes(payment.status)) return false;
  const stayEnd = payment.bookingCheckOut;
  return stayEnd && isStayDate(stayEnd) ? stayEnd >= today : isWaiting(payment);
}

const HAS_ZONE = /(?:Z|[+-]\d{2}:?\d{2})$/i;

function settledInstant(payment: PaymentListItem): string {
  const instant = payment.processedAt ?? payment.createdAt;
  return HAS_ZONE.test(instant) ? instant : `${instant}Z`;
}

export function settledDay(payment: PaymentListItem): string {
  return romeDateOf(settledInstant(payment));
}

export function settledTime(payment: PaymentListItem): number | null {
  const time = Date.parse(settledInstant(payment));
  return Number.isNaN(time) ? null : time;
}

export function dayInRange(day: string, range: { from?: string; to?: string }): boolean {
  if (!day) return !range.from && !range.to;
  return (!range.from || day >= range.from) && (!range.to || day <= range.to);
}

export function monthRange(day: string): string {
  return `${startOfMonth(day)}..${endOfMonth(day)}`;
}

export function previousMonthRange(day: string): string {
  return monthRange(addDays(startOfMonth(day), -1));
}

export interface PaymentsMonth {
  collectedCents: number;
  waitingCents: number;
  refundedCents: number;
}

export function summarizeMonth(payments: readonly PaymentListItem[], today: string): PaymentsMonth {
  const first = startOfMonth(today);
  const last = endOfMonth(today);
  const month: PaymentsMonth = { collectedCents: 0, waitingCents: 0, refundedCents: 0 };

  for (const payment of payments) {
    if (isWaiting(payment)) {
      month.waitingCents += payment.amountCents;
      continue;
    }
    const day = settledDay(payment);
    if (!day || day < first || day > last) continue;
    if (isCollected(payment)) month.collectedCents += Math.max(0, payment.amountCents - payment.refundedAmountCents);
    if (isGivenBack(payment)) month.refundedCents += payment.refundedAmountCents;
  }
  return month;
}
