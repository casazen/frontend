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
  /** `ical-block` only: `ICalImport` or `Manual` (CO-21). */
  blockSource?: string | null;
  /** `ical-block` only: its import feed (CO-21). */
  feedId?: string | null;
  /** `ical-block` only: the OTA stay created from it, while not cancelled (CO-21). */
  bookingId?: string | null;
  /** `ical-block` only: "Crea soggiorno OTA" is offered (CO-21). */
  convertible?: boolean | null;
  /** `booking` only: the feed of an OTA stay created from iCal (CO-21). */
  icalFeedId?: string | null;
  /** `booking` only: label of that feed when the stay was created (CO-21). */
  channelLabel?: string | null;
  /** `booking` only: why the OTA stay is "da verificare" (CO-21). */
  otaReviewReason?: OtaReviewReason | null;
}

/** Why an OTA stay created from an iCal block is "da verificare" (CO-21). */
export type OtaReviewReason = 'BlockRemoved' | 'BlockDatesChanged';

/** Matches backend CalendarResponseDto */
export interface CalendarResponseDto {
  timezone: string;
  utcOffsetMinutes: number;
  bookings: CalendarBookingDto[];
  /** Every booking and block of the range (`bookings` holds the bookings only). */
  items: CalendarItemDto[];
}
