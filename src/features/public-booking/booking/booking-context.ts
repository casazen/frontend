import { createContext, useContext } from 'react';
import type { StayCalendarData } from '@/features/public-site/stay/use-public-calendar';
import type { StayState } from '@/features/public-site/stay/stay-state';
import type { StayProblemKind } from '@/features/public-booking/booking/stay-exits';
import type { DirectBookingQuote, PublicPropertyDetailDto } from '@/types';

/** What the booking card knows about the price of the stay chosen. The price is the quote of the server and nothing else. */
export type QuoteView =
  /** No stay to price yet: the dates are missing. */
  | { status: 'none' }
  /** The stay cannot be had; `minNights` and `maxGuests` complete the sentence. */
  | { status: 'problem'; problem: StayProblemKind; minNights?: number; maxGuests?: number }
  /** The quote is on its way; `stale` is the one of the previous stay, kept in sight but never offered for booking. */
  | { status: 'loading'; stale: DirectBookingQuote | null }
  /** The quote of this stay. `estimatedTax`: the ages of the children are not asked yet, the server worked the tax out for the oldest age. */
  | { status: 'ready'; quote: DirectBookingQuote; estimatedTax: boolean }
  /** The quote could not be had for a reason that is not about the stay (network, server). */
  | { status: 'error'; message: string; retry: () => void };

/** Everything the booking card, the bar of the phone and the other parts of the page that follow the stay share. */
export interface BookingModel {
  property: PublicPropertyDetailDto;
  orgSlug: string;
  /** How the host is named, for «Scrivi a {host}». */
  hostLabel: string;
  /** The address the host published for the site, if any: the way to write when the home cannot be booked online. */
  contactEmail: string | null;
  stay: StayState;
  /** Adults and children together. */
  guests: number;
  /** The stay is in the address: a change replaces the entry, the page is not drawn again and nothing loses the focus. */
  setStay: (patch: Partial<StayState>) => void;
  clearDates: () => void;
  calendar: StayCalendarData;
  nights: number;
  /** The home takes pets: only then the picker offers the switch. */
  petsAllowed: boolean;
  quote: QuoteView;
  online: boolean;
  /** The org of the home can take a payment: when it cannot, the home is not bookable online yet and the card says so. */
  acceptsBookings: boolean;
  /** The lowest price of a free night in the calendar, in cents, else the rate of the home: «da 145 € / notte». */
  fromPriceCents: number | null;
  currency: string;
  /** The link of «Prenota»: only when the quote of this very stay is in, the person is online and the home takes bookings. */
  checkoutHref: string | null;
  /** Dates of the stay as the address says them, handed to a link to another page of the site. */
  linkTo: (path: string) => string;
}

export const BookingContext = createContext<BookingModel | null>(null);

/** The booking state of the property page: the stay of the address, the calendar and the quote of the server. */
export function useBooking(): BookingModel {
  const model = useContext(BookingContext);
  if (!model) throw new Error('useBooking must be used inside BookingProvider');
  return model;
}
