import type { Booking } from '@/types';

export const RECORDABLE_METHODS = ['CashOnArrival', 'BankTransfer'] as const;

const PORTAL_SOURCES: ReadonlySet<string> = new Set(['Airbnb', 'BookingCom', 'Expedia', 'Vrbo', 'TripAdvisor', 'Agoda']);

export function canRecordPayment(booking: Pick<Booking, 'status' | 'source'>): boolean {
  return booking.status !== 'Cancelled' && !(booking.source && PORTAL_SOURCES.has(booking.source));
}

export function balanceOf(booking: Pick<Booking, 'totalPrice' | 'paidAmount'>): number | null {
  if (typeof booking.paidAmount !== 'number' || !Number.isFinite(booking.totalPrice)) return null;
  return Math.max(0, Math.round((booking.totalPrice - booking.paidAmount) * 100) / 100);
}

export function newIdempotencyKey(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}
