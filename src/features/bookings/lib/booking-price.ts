import { nightsBetween } from '@/lib/stay-dates';
import type { Booking } from '@/types';

export function stayDateOf(value: string): string {
  return value.slice(0, 10);
}

export function bookingNights(booking: Pick<Booking, 'checkInDate' | 'checkOutDate'>): number {
  return nightsBetween(stayDateOf(booking.checkInDate), stayDateOf(booking.checkOutDate));
}

export interface BookingPriceBreakdown {
  nights: number;
  lodging: number;
  perNight: number;
  cleaningFee: number;
  touristTax: number;
  total: number;
}

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
