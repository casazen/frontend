// ✅ Fixed: Backend uses PascalCase enum values
export type BookingStatus = 'Pending' | 'Confirmed' | 'CheckedIn' | 'CheckedOut' | 'Cancelled';

/** Inline guest info embedded in booking (subset of the full Guest entity) */
export interface BookingGuest {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  country: string;
}

export interface Booking {
  id: string;
  propertyId: string;
  propertyName?: string;
  userId: string;
  checkInDate: string;
  checkOutDate: string;
  numberOfGuests: number;
  totalPrice: number;
  currency: string;
  status: BookingStatus;
  guest: BookingGuest;
  specialRequests?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBookingDto {
  propertyId: string;
  checkInDate: string;
  checkOutDate: string;
  numberOfGuests: number;
  guest: BookingGuest;
  specialRequests?: string;
}

export interface UpdateBookingDto extends Partial<CreateBookingDto> {
  status?: BookingStatus;
}

export interface BookingCalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  resource?: Booking;
  eventType?: 'booking' | 'ical-block';
}

export interface CheckInDto {
  actualCheckInTime?: string;
  notes?: string;
}

export interface CheckOutDto {
  actualCheckOutTime?: string;
  notes?: string;
  damages?: string;
}
