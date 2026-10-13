import { nightsBetween } from '@/lib/stay-dates';
import type { Booking } from '@/types';

/** Calendar date (`YYYY-MM-DD`) of a stay date sent by the API as midnight UTC. */
export function stayDateOf(value: string): string {
  return value.slice(0, 10);
}

/** Nights of the booking (0 when the dates are missing or not in order). */
export function bookingNights(booking: Pick<Booking, 'checkInDate' | 'checkOutDate'>): number {
  return nightsBetween(stayDateOf(booking.checkInDate), stayDateOf(booking.checkOutDate));
}

export interface BookingPriceBreakdown {
  nights: number;
  /** Lodging of the whole stay: base price without the cleaning fee. */
  lodging: number;
  /** Lodging per night: tourist tax and cleaning excluded (A2-30). */
  perNight: number;
  cleaningFee: number;
  touristTax: number;
  total: number;
}

/**
 * Price of a booking as recorded by the backend: `basePrice` is lodging + cleaning, the tourist tax comes on top. Null
 * when the booking has no nights or no recorded base price (e.g. imported from a channel without prices).
 */
export function bookingPriceBreakdown(
  booking: Pick<Booking, 'checkInDate' | 'checkOutDate' | 'basePrice' | 'cleaningFee' | 'touristTax' | 'totalPrice'>,
): BookingPriceBreakdown | null {
  const nights = bookingNights(booking);
  const basePrice = booking.basePrice ?? 0;
  if (nights === 0 || basePrice <= 0) return null;

  const cleaningFee = Math.min(booking.cleaningFee ?? 0, basePrice);
  const lodging = basePrice - cleaningFee;
  return {
    nights,
    lodging,
    perNight: Math.round((lodging / nights) * 100) / 100,
    cleaningFee,
    touristTax: booking.touristTax ?? 0,
    total: booking.totalPrice,
  };
}
