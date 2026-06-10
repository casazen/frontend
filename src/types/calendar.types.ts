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

/** Matches backend CalendarResponseDto */
export interface CalendarResponseDto {
  timezone: string;
  utcOffsetMinutes: number;
  bookings: CalendarBookingDto[];
}
