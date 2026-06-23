import { z } from 'zod';

export const guestSchema = z.object({
  firstName: z.string().min(2, 'booking.validation.firstName.minLength'),
  lastName: z.string().min(2, 'booking.validation.lastName.minLength'),
  email: z.string().email('booking.validation.email.format'),
  phone: z.string().min(10, 'booking.validation.phone.minLength'),
  country: z.string().min(2, 'booking.validation.country.required'),
});

export const bookingFormSchema = z.object({
  propertyId: z.string().min(1, 'booking.validation.propertyId.required'),
  checkInDate: z.string().min(1, 'booking.validation.checkInDate.required'),
  checkOutDate: z.string().min(1, 'booking.validation.checkOutDate.required'),
  numberOfGuests: z.number().int().min(1, 'booking.validation.numberOfGuests.min').max(100),
  guest: guestSchema,
  specialRequests: z.string().optional(),
}).refine((data) => {
  const checkIn = new Date(data.checkInDate);
  const checkOut = new Date(data.checkOutDate);
  return checkOut > checkIn;
}, {
  message: 'booking.validation.checkOutDate.afterCheckIn',
  path: ['checkOutDate'],
});

export const checkInFormSchema = z.object({
  actualCheckInTime: z.string().optional(),
  notes: z.string().optional(),
});

export const checkOutFormSchema = z.object({
  actualCheckOutTime: z.string().optional(),
  notes: z.string().optional(),
  damages: z.string().optional(),
});

export type GuestFormValues = z.infer<typeof guestSchema>;
export type BookingFormValues = z.infer<typeof bookingFormSchema>;
export type CheckInFormValues = z.infer<typeof checkInFormSchema>;
export type CheckOutFormValues = z.infer<typeof checkOutFormSchema>;

// Booking status labels are now resolved via getBookingStatusLabel() from @/lib/i18n-labels.
// Booking status variants stay here as a UI-only concern (no i18n needed).
export const BOOKING_STATUS_VARIANTS: Record<string, 'default' | 'success' | 'warning' | 'destructive' | 'secondary'> = {
  Pending: 'warning',
  Confirmed: 'default',
  CheckedIn: 'success',
  CheckedOut: 'secondary',
  Cancelled: 'destructive',
  PENDING: 'warning',
  CONFIRMED: 'default',
  CHECKED_IN: 'success',
  CHECKED_OUT: 'secondary',
  CANCELLED: 'destructive',
};
