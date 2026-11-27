import { z } from 'zod';

export const guestSchema = z.object({
  firstName: z.string().min(2, 'booking.validation.firstName.minLength'),
  lastName: z.string().min(2, 'booking.validation.lastName.minLength'),
  email: z.string().email('booking.validation.email.format'),
  phone: z.string().min(10, 'booking.validation.phone.minLength'),
  country: z.string().min(2, 'booking.validation.country.required'),
});

const bookingFieldsSchema = z.object({
  propertyId: z.string().min(1, 'booking.validation.propertyId.required'),
  checkInDate: z.string().min(1, 'booking.validation.checkInDate.required'),
  checkOutDate: z.string().min(1, 'booking.validation.checkOutDate.required'),
  numberOfGuests: z
    .number({ error: 'booking.validation.numberOfGuests.min' })
    .int('booking.validation.numberOfGuests.min')
    .min(1, 'booking.validation.numberOfGuests.min')
    .max(100),
  numberOfChildren: z
    .number({ error: 'booking.validation.numberOfChildren.invalid' })
    .int('booking.validation.numberOfChildren.invalid')
    .min(0, 'booking.validation.numberOfChildren.invalid'),
  guest: guestSchema.optional(),
  specialRequests: z.string().max(1000).optional(),
});

export function bookingFormSchema(mode: 'create' | 'edit') {
  return bookingFieldsSchema.superRefine((data, ctx) => {
    if (mode === 'create' && !data.guest) {
      ctx.addIssue({ code: 'custom', path: ['guest', 'firstName'], message: 'booking.validation.firstName.minLength' });
    }
    if (data.checkInDate && data.checkOutDate && data.checkOutDate <= data.checkInDate) {
      ctx.addIssue({ code: 'custom', path: ['checkOutDate'], message: 'booking.validation.checkOutDate.afterCheckIn' });
    }
    if (data.numberOfChildren >= data.numberOfGuests) {
      ctx.addIssue({
        code: 'custom',
        path: ['numberOfChildren'],
        message: 'booking.validation.numberOfChildren.lessThanGuests',
      });
    }
  });
}

export type BookingFormValues = z.infer<typeof bookingFieldsSchema>;

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
