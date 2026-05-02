// ✅ Calendar types matching backend CalendarResponseDto

export interface CalendarDay {
  date: Date | string;
  isAvailable: boolean;
  price: number;
  minimumStay: number;
  bookingId?: string;
}

export interface CalendarResponseDto {
  propertyId: string;
  startDate: Date | string;
  endDate: Date | string;
  days: CalendarDay[];
}
