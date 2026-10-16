import { addDays, endOfMonth, romeDateOf, startOfMonth } from '@/lib/stay-dates';
import type { PaymentListItem, PaymentStatus } from '@/types';

/** `/app/short-rent/payments`: the page, and where the numbers of the month lead (`?chip=toCollect&f_date=…`). */
export const PAYMENTS_PATH = '/app/short-rent/payments';

/** The page of one payment. */
export const paymentPath = (payment: Pick<PaymentListItem, 'id'>) => `${PAYMENTS_PATH}/${payment.id}`;

/** The money is in the hands of the host: it came in and was not all given back (the cash rule of the backend, `PaymentCashRules`). */
const COLLECTED: readonly PaymentStatus[] = ['Completed', 'PartiallyRefunded'];
/** Recorded or on its way, not arrived yet. */
const WAITING: readonly PaymentStatus[] = ['Pending', 'Processing'];
/** Given back to the guest, all or in part. */
const GIVEN_BACK: readonly PaymentStatus[] = ['Refunded', 'PartiallyRefunded'];

export const isCollected = (payment: PaymentListItem) => COLLECTED.includes(payment.status);
export const isWaiting = (payment: PaymentListItem) => WAITING.includes(payment.status);
export const isGivenBack = (payment: PaymentListItem) => GIVEN_BACK.includes(payment.status);

const HAS_ZONE = /(?:Z|[+-]\d{2}:?\d{2})$/i;

/**
 * When the payment counts from: the instant the money came in, else the one it was recorded (`ProcessedAt ?? CreatedAt`, as the
 * backend and the fiscal reports have it). The API writes every instant in UTC; one with no zone is read as UTC.
 */
function settledInstant(payment: PaymentListItem): string {
  const instant = payment.processedAt ?? payment.createdAt;
  return HAS_ZONE.test(instant) ? instant : `${instant}Z`;
}

/** The day (Europe/Rome, `YYYY-MM-DD`) the payment counts on; empty when the API sent something that is not a date. */
export function settledDay(payment: PaymentListItem): string {
  return romeDateOf(settledInstant(payment));
}

/** The same moment as a number, to put the payments in order; `null` when it is not a date. */
export function settledTime(payment: PaymentListItem): number | null {
  const time = Date.parse(settledInstant(payment));
  return Number.isNaN(time) ? null : time;
}

/** Is the day inside a range of the date filter (either end may be missing)? A payment with no readable day is in no range. */
export function dayInRange(day: string, range: { from?: string; to?: string }): boolean {
  if (!day) return !range.from && !range.to;
  return (!range.from || day >= range.from) && (!range.to || day <= range.to);
}

/** `2026-10-01..2026-10-31`: the month of `day` as the date filter and the address write it. */
export function monthRange(day: string): string {
  return `${startOfMonth(day)}..${endOfMonth(day)}`;
}

/** The month before the one of `day`, as `monthRange`. */
export function previousMonthRange(day: string): string {
  return monthRange(addDays(startOfMonth(day), -1));
}

/** The three numbers over the payments: what came in, what is still to come, what went back. All in cents. */
export interface PaymentsMonth {
  /** Collected in the month, net of what was given back (by cash, as the Home counts it). */
  collectedCents: number;
  /** Not arrived yet, whatever the day it was recorded. */
  waitingCents: number;
  /** Given back on the payments of the month. */
  refundedCents: number;
}

/**
 * The numbers of the month of `today` (a day in Europe/Rome). A payment counts in the month it came in, as the backend counts
 * it (`ProcessedAt ?? CreatedAt`), and what is given back later is taken from that month: the same sum the Home shows.
 */
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
