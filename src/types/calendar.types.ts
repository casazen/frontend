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
}

/** Matches backend CalendarResponseDto */
export interface CalendarResponseDto {
  timezone: string;
  utcOffsetMinutes: number;
  bookings: CalendarBookingDto[];
  items?: CalendarItemDto[];
}
