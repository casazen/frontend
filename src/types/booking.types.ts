// ✅ Fixed: Backend uses PascalCase enum values
export type BookingStatus = 'Pending' | 'Confirmed' | 'CheckedIn' | 'CheckedOut' | 'Cancelled';

export interface Guest {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  country: string;
}

export interface Booking {
  id: string;
  propertyId: string;
  userId: string;
  checkInDate: string;
  checkOutDate: string;
  numberOfGuests: number;
  totalPrice: number;
  currency: string;
  status: BookingStatus;
  guest: Guest;
  specialRequests?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBookingDto {
  propertyId: string;
  checkInDate: string;
  checkOutDate: string;
  numberOfGuests: number;
  guest: Guest;
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
