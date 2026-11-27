import type { DirectBookingQuote } from '@/types';

export function quoteTotalCents(quote: DirectBookingQuote): number {
  const total = quote.lines?.find((line) => line.kind === 'Total');
  return total ? total.amountCents : Math.round(quote.totalPrice * 100);
}
