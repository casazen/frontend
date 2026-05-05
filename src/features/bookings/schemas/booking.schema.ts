import { z } from 'zod';

export const guestSchema = z.object({
  firstName: z.string().min(2, 'First name must be at least 2 characters'),
  lastName: z.string().min(2, 'Last name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  phone: z.string().min(10, 'Phone number must be at least 10 digits'),
  country: z.string().min(2, 'Country is required'),
});

export const bookingFormSchema = z.object({
  propertyId: z.string().min(1, 'Property is required'),
  checkInDate: z.string().min(1, 'Check-in date is required'),
  checkOutDate: z.string().min(1, 'Check-out date is required'),
  numberOfGuests: z.number().int().min(1, 'At least 1 guest is required').max(100),
  guest: guestSchema,
  specialRequests: z.string().optional(),
}).refine((data) => {
  const checkIn = new Date(data.checkInDate);
  const checkOut = new Date(data.checkOutDate);
  return checkOut > checkIn;
}, {
  message: 'Check-out date must be after check-in date',
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

export const BOOKING_STATUS_LABELS: Record<string, { label: string; variant: 'default' | 'success' | 'warning' | 'destructive' | 'secondary' }> = {
  // PascalCase (current backend format)
  Pending: { label: 'Pending', variant: 'warning' },
  Confirmed: { label: 'Confirmed', variant: 'default' },
  CheckedIn: { label: 'Checked In', variant: 'success' },
  CheckedOut: { label: 'Checked Out', variant: 'secondary' },
  Cancelled: { label: 'Cancelled', variant: 'destructive' },
  // UPPER_CASE fallback (legacy)
  PENDING: { label: 'Pending', variant: 'warning' },
  CONFIRMED: { label: 'Confirmed', variant: 'default' },
  CHECKED_IN: { label: 'Checked In', variant: 'success' },
  CHECKED_OUT: { label: 'Checked Out', variant: 'secondary' },
  CANCELLED: { label: 'Cancelled', variant: 'destructive' },
};
