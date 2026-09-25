/** Matches backend CalendarBookingDto */
export interface CalendarBookingDto {
  id: string;
  propertyId: string;
  guestId: string;
  checkInDate: string;
  checkOutDate: string;
  checkInDateUtc: string;
  checkOutDateUtc: string;
  status: string;
  source: string;
  numberOfGuests: number;
  totalPrice: number;
  guestName: string;
}

/** Matches backend CalendarItemDto */
export interface CalendarItemDto {
  type: 'booking' | 'ical-block' | string;
  id: string;
  propertyId: string;
  startDate: string;
  endDate: string;
  startDateUtc: string;
  endDateUtc: string;
  status?: string;
  source?: string;
  numberOfGuests?: number;
  totalPrice?: number;
  guestName?: string;
  summary?: string;
  /** Label of the feed (a block) or of the feed of an OTA stay created from iCal (a booking), CO-21. */
  channelLabel?: string | null;
  /** Block only: `ICalImport` or `Manual`. */
  blockSource?: 'ICalImport' | 'Manual' | string | null;
  /** Block only: its import feed and the channel of that feed. */
  feedId?: string | null;
  channel?: 'Airbnb' | 'BookingCom' | 'Other' | string | null;
  /** Block only: the OTA stay created from it, while not cancelled. */
  bookingId?: string | null;
  /** Block only: "Crea soggiorno OTA" is offered. */
  convertible?: boolean | null;
  /** Booking only: the feed of an OTA stay created from iCal, and why it is "da verificare". */
  icalFeedId?: string | null;
  otaReviewReason?: OtaReviewReason | null;
}

/** Why an OTA stay created from an iCal block is "da verificare" (CO-21). */
export type OtaReviewReason = 'BlockRemoved' | 'BlockDatesChanged';

/** Matches backend CalendarResponseDto */
export interface CalendarResponseDto {
  timezone: string;
  utcOffsetMinutes: number;
  bookings: CalendarBookingDto[];
  items?: CalendarItemDto[];
}
