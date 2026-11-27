import { formatStayDate, todayInRome } from '@/lib/stay-dates';
import { stayDateOf } from '@/features/bookings/lib/booking-price';
import type { Booking } from '@/types';

type TranslateFn = (key: string, options?: Record<string, unknown>) => string;

export function orderStaysForRequest(bookings: Booking[], today: string = todayInRome()): Booking[] {
  const live = bookings.filter((b) => b.status !== 'Cancelled');
  const current = live
    .filter((b) => stayDateOf(b.checkOutDate) >= today)
    .sort((a, b) => stayDateOf(a.checkInDate).localeCompare(stayDateOf(b.checkInDate)));
  const past = live
    .filter((b) => stayDateOf(b.checkOutDate) < today)
    .sort((a, b) => stayDateOf(b.checkInDate).localeCompare(stayDateOf(a.checkInDate)));
  return [...current, ...past];
}

export function stayOptionLabel(booking: Booking, t: TranslateFn, locale: string): string {
  const guest = `${booking.guest?.firstName ?? ''} ${booking.guest?.lastName ?? ''}`.trim();
  return t('serviceRequest.stayOption', {
    guest: guest || t('compliance.checkout.guestFallback'),
    from: formatStayDate(stayDateOf(booking.checkInDate), locale),
    to: formatStayDate(stayDateOf(booking.checkOutDate), locale),
  });
}
