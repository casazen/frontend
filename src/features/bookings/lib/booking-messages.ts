import type { Booking } from '@/types';

/**
 * Whether a booking can have a thread of messages with its guest (DB-14a): only a booking made through the booking site
 * (`Direct`, where the guest has an area to write from) that is confirmed and not cancelled. The server says the same with a thread
 * of state `Unavailable`; this tells the page, before asking, whether to show «Messaggi» at all.
 */
export function bookingHasMessages(booking: Pick<Booking, 'source' | 'status'>): boolean {
  return booking.source === 'Direct' && (booking.status === 'Confirmed' || booking.status === 'CheckedIn' || booking.status === 'CheckedOut');
}
