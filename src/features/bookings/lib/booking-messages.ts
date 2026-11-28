import type { Booking } from '@/types';

export function bookingHasMessages(booking: Pick<Booking, 'source' | 'status'>, guestPortal = false): boolean {
  return (guestPortal || booking.source === 'Direct') && (booking.status === 'Confirmed' || booking.status === 'CheckedIn' || booking.status === 'CheckedOut');
}
