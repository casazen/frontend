import { stayDateOf } from '@/features/bookings/lib/booking-price';
import { formatStayDate } from '@/lib/stay-dates';
import type { Booking } from '@/types';

/** Where the stay in focus is: the guest is in the property now, is about to arrive, or has left. */
export type GuestStayPhase = 'inProgress' | 'upcoming' | 'past';

export interface GuestFocusStay {
  booking: Booking;
  phase: GuestStayPhase;
}

/** The stays of a guest, the latest check-in first (the API already sends them so; the page does not rely on it). */
export function sortStays(bookings: readonly Booking[]): Booking[] {
  return [...bookings].sort((a, b) => stayDateOf(b.checkInDate).localeCompare(stayDateOf(a.checkInDate)));
}

/** The guest is in the property: the arrival is registered and the departure is not, or the stay is under way by its dates. */
function isInProgress(booking: Booking, today: string): boolean {
  if (booking.status === 'CheckedIn') return true;
  return booking.status === 'Confirmed' && stayDateOf(booking.checkInDate) < today && stayDateOf(booking.checkOutDate) >= today;
}

/**
 * The one stay the page puts first (SR-04b): the one in progress, otherwise the next one to come, otherwise the last one that
 * ended. A cancelled booking is not a stay of the guest, so it is never the one in focus; a guest with only cancelled
 * bookings has none. `today` is the calendar day in Europe/Rome.
 */
export function focusStayOf(bookings: readonly Booking[], today: string): GuestFocusStay | null {
  const latestFirst = sortStays(bookings).filter((booking) => booking.status !== 'Cancelled');

  const inProgress = latestFirst
    .filter((booking) => isInProgress(booking, today))
    .sort((a, b) => stayDateOf(a.checkOutDate).localeCompare(stayDateOf(b.checkOutDate)))[0];
  if (inProgress) return { booking: inProgress, phase: 'inProgress' };

  const upcoming = [...latestFirst].reverse().find((booking) => booking.status !== 'CheckedOut' && stayDateOf(booking.checkOutDate) >= today);
  if (upcoming) return { booking: upcoming, phase: 'upcoming' };

  const past = latestFirst[0];
  return past ? { booking: past, phase: 'past' } : null;
}

/**
 * "12 ott → 15 ott" for the dates of a stay, with the year when a date is not in this year. Stay dates are calendar days: they
 * are read as written, never moved by a time zone.
 */
export function stayRangeText(booking: Pick<Booking, 'checkInDate' | 'checkOutDate'>, language: string, today: string): string {
  const thisYear = today.slice(0, 4);
  const day = (value: string) => {
    const stay = stayDateOf(value);
    return formatStayDate(stay, language, stay.startsWith(thisYear) ? { day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short', year: 'numeric' });
  };
  return `${day(booking.checkInDate)} → ${day(booking.checkOutDate)}`;
}
