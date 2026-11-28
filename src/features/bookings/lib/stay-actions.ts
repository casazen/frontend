import type { Booking } from '@/types';
import { todayInRome } from '@/lib/stay-dates';
import { stayDateOf } from './booking-price';

type StayDates = Pick<Booking, 'status' | 'checkInDate' | 'checkOutDate'>;

export function canRegisterArrival(booking: StayDates, today: string = todayInRome()): boolean {
  return (
    booking.status === 'Confirmed' &&
    stayDateOf(booking.checkInDate) <= today &&
    today <= stayDateOf(booking.checkOutDate)
  );
}

export function hasStayStarted(booking: StayDates, today: string = todayInRome()): boolean {
  return stayDateOf(booking.checkInDate) <= today;
}

export function canOpenCheckOut(booking: StayDates, today: string = todayInRome()): boolean {
  if (booking.status === 'CheckedIn') return hasStayStarted(booking, today);
  return booking.status === 'Confirmed' && stayDateOf(booking.checkOutDate) <= today;
}

export function checkInWizardPath(bookingId: string, fromDocuments = false): string {
  return `/app/short-rent/bookings/${bookingId}/check-in${fromDocuments ? '?return=documents' : ''}`;
}

/** Tab of the booking detail where the host completes the guest data for Alloggiati Web (CO-12). */
export function guestDataCompletionPath(bookingId: string): string {
  return `/app/short-rent/bookings/${bookingId}?tab=alloggiati`;
}
