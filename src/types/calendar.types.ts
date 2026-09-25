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

/**
 * Matches backend CalendarItemDto (`GET /api/bookings/calendar`, MO-06): a booking or a calendar block (`ical-block`,
 * dates taken on another channel, no booking detail). `startDate`/`endDate` are the arrival and departure days as stay
 * dates without time zone (`2026-09-30T00:00:00`): read them with `parseStayDate`, never with `new Date()`.
 */
export interface CalendarItemDto {
  type: 'booking' | 'ical-block' | string;
  id: string;
  propertyId: string;
  startDate: string;
  endDate: string;
  startDateUtc: string;
  endDateUtc: string;
  status?: string | null;
  source?: string | null;
  numberOfGuests?: number | null;
  totalPrice?: number | null;
  guestName?: string | null;
  summary?: string | null;
  /** `ical-block` only: channel of the feed (`Airbnb`, `BookingCom`, `Other`), null for a block without feed. */
  channel?: string | null;
  /** `ical-block` only: label the host gave to the feed. */
  feedLabel?: string | null;
}

/** Matches backend CalendarResponseDto */
export interface CalendarResponseDto {
  timezone: string;
  utcOffsetMinutes: number;
  bookings: CalendarBookingDto[];
  /** Every booking and block of the range (`bookings` holds the bookings only). */
  items: CalendarItemDto[];
}
