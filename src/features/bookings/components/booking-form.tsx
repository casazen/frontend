import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { bookingFormSchema } from '../schemas/booking.schema';
import { useProperties } from '@/queries/use-properties';
import type { BookingFormValues } from '../schemas/booking.schema';
import type { Booking } from '@/types';

interface BookingFormProps {
  booking?: Booking;
  onSubmit: (data: BookingFormValues) => void;
  isLoading?: boolean;
}

export function BookingForm({ booking, onSubmit, isLoading }: BookingFormProps) {
  const { data: propertiesData } = useProperties();
  const properties = propertiesData?.data || [];

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<BookingFormValues>({
    resolver: zodResolver(bookingFormSchema),
    defaultValues: booking ? {
      propertyId: booking.propertyId,
      checkInDate: booking.checkInDate.split('T')[0],
      checkOutDate: booking.checkOutDate.split('T')[0],
      numberOfGuests: booking.numberOfGuests,
      guest: booking.guest,
      specialRequests: booking.specialRequests,
    } : {} as any,
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Booking Details */}
      <Card>
        <CardHeader>
          <CardTitle>Booking Details</CardTitle>
          <CardDescription>Property and dates information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="propertyId">Property *</Label>
            <select
              id="propertyId"
              {...register('propertyId')}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              disabled={!!booking}
            >
              <option value="">Select a property</option>
              {properties.map((property) => (
                <option key={property.id} value={property.id}>
                  {property.name} - {property.city}
                </option>
              ))}
            </select>
            {errors.propertyId && (
              <p className="text-sm text-destructive">{errors.propertyId.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="checkInDate">Check-in Date *</Label>
              <Input
                id="checkInDate"
                type="date"
                {...register('checkInDate')}
              />
              {errors.checkInDate && (
                <p className="text-sm text-destructive">{errors.checkInDate.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="checkOutDate">Check-out Date *</Label>
              <Input
                id="checkOutDate"
                type="date"
                {...register('checkOutDate')}
              />
              {errors.checkOutDate && (
                <p className="text-sm text-destructive">{errors.checkOutDate.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="numberOfGuests">Number of Guests *</Label>
            <Input
              id="numberOfGuests"
              type="number"
              {...register('numberOfGuests', { valueAsNumber: true })}
              placeholder="2"
            />
            {errors.numberOfGuests && (
              <p className="text-sm text-destructive">{errors.numberOfGuests.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="specialRequests">Special Requests</Label>
            <Textarea
              id="specialRequests"
              {...register('specialRequests')}
              placeholder="Any special requirements or requests..."
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Guest Information */}
      <Card>
        <CardHeader>
          <CardTitle>Guest Information</CardTitle>
          <CardDescription>Primary guest contact details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="guest.firstName">First Name *</Label>
              <Input
                id="guest.firstName"
                {...register('guest.firstName')}
                placeholder="John"
              />
              {errors.guest?.firstName && (
                <p className="text-sm text-destructive">{errors.guest.firstName.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="guest.lastName">Last Name *</Label>
              <Input
                id="guest.lastName"
                {...register('guest.lastName')}
                placeholder="Doe"
              />
              {errors.guest?.lastName && (
                <p className="text-sm text-destructive">{errors.guest.lastName.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="guest.email">Email *</Label>
            <Input
              id="guest.email"
              type="email"
              {...register('guest.email')}
              placeholder="john.doe@example.com"
            />
            {errors.guest?.email && (
              <p className="text-sm text-destructive">{errors.guest.email.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="guest.phone">Phone *</Label>
              <Input
                id="guest.phone"
                type="tel"
                {...register('guest.phone')}
                placeholder="+1234567890"
              />
              {errors.guest?.phone && (
                <p className="text-sm text-destructive">{errors.guest.phone.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="guest.country">Country *</Label>
              <Input
                id="guest.country"
                {...register('guest.country')}
                placeholder="USA"
              />
              {errors.guest?.country && (
                <p className="text-sm text-destructive">{errors.guest.country.message}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Form Actions */}
      <div className="flex justify-end gap-4">
        <Button type="button" variant="outline" disabled={isLoading}>
          Cancel
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Saving...' : booking ? 'Update Booking' : 'Create Booking'}
        </Button>
      </div>
    </form>
  );
}
