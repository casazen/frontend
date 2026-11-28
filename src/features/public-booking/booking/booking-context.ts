import { createContext, useContext } from 'react';
import type { StayCalendarData } from '@/features/public-site/stay/use-public-calendar';
import type { StayState } from '@/features/public-site/stay/stay-state';
import type { StayProblemKind } from '@/features/public-booking/booking/stay-exits';
import type { DirectBookingQuote, PublicPropertyDetailDto } from '@/types';

export type QuoteView =
  | { status: 'none' }
  | { status: 'problem'; problem: StayProblemKind; minNights?: number; maxNights?: number; maxGuests?: number }
  | { status: 'loading'; stale: DirectBookingQuote | null }
  | { status: 'ready'; quote: DirectBookingQuote; estimatedTax: boolean }
  | { status: 'error'; message: string; retry: () => void };

export interface BookingModel {
  property: PublicPropertyDetailDto;
  orgSlug: string;
  hostLabel: string;
  contactEmail: string | null;
  stay: StayState;
  guests: number;
  setStay: (patch: Partial<StayState>) => void;
  clearDates: () => void;
  calendar: StayCalendarData;
  nights: number;
  petsAllowed: boolean;
  quote: QuoteView;
  online: boolean;
  acceptsBookings: boolean;
  fromPriceCents: number | null;
  currency: string;
  checkoutHref: string | null;
  linkTo: (path: string) => string;
}

export const BookingContext = createContext<BookingModel | null>(null);

export function useBooking(): BookingModel {
  const model = useContext(BookingContext);
  if (!model) throw new Error('useBooking must be used inside BookingProvider');
  return model;
}
