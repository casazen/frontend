import type { ReactNode } from 'react';
import { BookingContext } from '@/features/public-booking/booking/booking-context';
import { useBookingModel } from '@/features/public-booking/booking/use-booking-model';
import type { PublicPropertyDetailDto } from '@/types';

interface BookingProviderProps {
  property: PublicPropertyDetailDto;
  orgSlug: string;
  hostLabel: string;
  contactEmail: string | null;
  /** The ages of the children when the page asks them (the checkout). */
  childrenAges?: readonly (number | null)[];
  children: ReactNode;
}

/**
 * Holds the stay of the property page (DB-04b): the dates and guests of the address, the calendar and the quote. Whoever follows
 * the stay (the card, the bar and sheet of the phone, the calendar of the page, the rules with the real cancellation dates) reads it
 * with `useBooking`; the rest of the page is not drawn again when it changes, so the focus stays where it is.
 */
export function BookingProvider({ property, orgSlug, hostLabel, contactEmail, childrenAges, children }: BookingProviderProps) {
  const model = useBookingModel({ property, orgSlug, hostLabel, contactEmail, childrenAges });
  return <BookingContext.Provider value={model}>{children}</BookingContext.Provider>;
}
