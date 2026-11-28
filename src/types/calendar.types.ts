interface CalendarBookingDto {
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
  channel?: string | null;
  feedLabel?: string | null;
  blockSource?: string | null;
  blockReason?: string | null;
  feedId?: string | null;
  bookingId?: string | null;
  convertible?: boolean | null;
  icalFeedId?: string | null;
  channelLabel?: string | null;
  otaReviewReason?: OtaReviewReason | null;
}

export type OtaReviewReason = 'BlockRemoved' | 'BlockDatesChanged';

export interface CalendarResponseDto {
  timezone: string;
  utcOffsetMinutes: number;
  bookings: CalendarBookingDto[];
  items: CalendarItemDto[];
}

export const MANUAL_BLOCK_REASONS = ['Owner', 'Maintenance', 'Other'] as const;
export type ManualBlockReason = (typeof MANUAL_BLOCK_REASONS)[number];

export const MODE_CHANGE_BLOCK_REASON = 'ModeChange';
export type BlockReason = ManualBlockReason | typeof MODE_CHANGE_BLOCK_REASON;

export const MANUAL_BLOCK_NOTE_MAX_LENGTH = 200;

export const MANUAL_BLOCK_MAX_NIGHTS = 366;

export interface CreateManualBlockDto {
  startDate: string;
  endDate: string;
  reason: ManualBlockReason;
  note?: string;
}

export interface ManualBlockDto {
  id: string;
  propertyId: string;
  startDate: string;
  endDate: string;
  nights: number;
  reason: ManualBlockReason | string;
  note?: string | null;
}
