import type { Booking } from '@/types';

/** The ways a host records money that came in by hand: the methods the backend accepts for a recorded payment (`ManualPaymentService`). */
export const RECORDABLE_METHODS = ['CashOnArrival', 'BankTransfer'] as const;

/** The channels that collect the money themselves: the host records nothing on their stays. */
const PORTAL_SOURCES: ReadonlySet<string> = new Set(['Airbnb', 'BookingCom', 'Expedia', 'Vrbo', 'TripAdvisor', 'Agoda']);

/** A booking a receipt can be recorded on: not cancelled, and not from a portal (the same rule as the backend, which has the last word). */
export function canRecordPayment(booking: Pick<Booking, 'status' | 'source'>): boolean {
  return booking.status !== 'Cancelled' && !(booking.source && PORTAL_SOURCES.has(booking.source));
}

/**
 * What is still to be collected on a booking, in euros: the total minus what came in. `null` when it cannot be known (whoever may not
 * read the payments is not told what came in) or the booking has no total.
 */
export function balanceOf(booking: Pick<Booking, 'totalPrice' | 'paidAmount'>): number | null {
  if (typeof booking.paidAmount !== 'number' || !Number.isFinite(booking.totalPrice)) return null;
  return Math.max(0, Math.round((booking.totalPrice - booking.paidAmount) * 100) / 100);
}

/** A new key for a record: the form keeps it until the record goes through, so a second send of the same record is not a second record. */
export function newIdempotencyKey(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}
