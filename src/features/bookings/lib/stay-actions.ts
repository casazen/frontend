import type { Booking } from '@/types';
import { todayInRome } from '@/lib/stay-dates';
import { stayDateOf } from './booking-price';

type StayDates = Pick<Booking, 'status' | 'checkInDate' | 'checkOutDate'>;

/**
 * "Registra arrivo" (CO-08): a confirmed booking from its check-in day to its check-out day (Europe/Rome), the rule of
 * `POST /bookings/:id/check-in`. A registration on a later day of the stay is normal (the host forgot it).
 */
export function canRegisterArrival(booking: StayDates, today: string = todayInRome()): boolean {
  return (
    booking.status === 'Confirmed' &&
    stayDateOf(booking.checkInDate) <= today &&
    today <= stayDateOf(booking.checkOutDate)
  );
}

/** True when the check-in day of the stay has come (Europe/Rome). */
export function hasStayStarted(booking: StayDates, today: string = todayInRome()): boolean {
  return stayDateOf(booking.checkInDate) <= today;
}

/**
 * Link to the check-out wizard (CO-08, same rules as the API): a stay with the arrival registered, or a confirmed one
 * from its departure day, whose arrival the wizard registers with "registra arrivo e procedi".
 */
export function canOpenCheckOut(booking: StayDates, today: string = todayInRome()): boolean {
  if (booking.status === 'CheckedIn') return hasStayStarted(booking, today);
  return booking.status === 'Confirmed' && stayDateOf(booking.checkOutDate) <= today;
}

/** Tab of the booking detail where the host completes the guest data for Alloggiati Web (CO-12). */
export function guestDataCompletionPath(bookingId: string): string {
  return `/app/short-rent/bookings/${bookingId}?tab=alloggiati`;
}
