import type { DirectBookingQuote } from '@/types';

/**
 * The total of a quote in cents, as the server sends it: the line `Total` when the quote has its lines, else the total in euros
 * of an older backend, rounded to the cent. It is a unit conversion, never a sum.
 */
export function quoteTotalCents(quote: DirectBookingQuote): number {
  const total = quote.lines?.find((line) => line.kind === 'Total');
  return total ? total.amountCents : Math.round(quote.totalPrice * 100);
}
