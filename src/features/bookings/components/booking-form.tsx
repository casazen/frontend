import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { bookingFormSchema } from '../schemas/booking.schema';
import { useProperties } from '@/queries/use-properties';
import type { BookingFormValues } from '../schemas/booking.schema';
import type { Booking } from '@/types';
import { FormFieldError } from '@/components/shared/form-field-error';

interface BookingFormProps {
  booking?: Booking;
  onSubmit: (data: BookingFormValues) => void;
  isLoading?: boolean;
}

export function BookingForm({ booking, onSubmit, isLoading }: BookingFormProps) {
  const { t } = useTranslation();
  const { data: propertiesData } = useProperties();
  const properties = propertiesData ?? [];

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
    } : {},
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Booking Details */}
      <Card>
        <CardHeader>
          <CardTitle>{t('booking.form.bookingDetails')}</CardTitle>
          <CardDescription>{t('booking.form.bookingDetailsDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="propertyId">{t('booking.form.property')}</Label>
            <select
              id="propertyId"
              {...register('propertyId')}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              disabled={!!booking}
            >
              <option value="">{t('booking.form.selectProperty')}</option>
              {properties.map((property) => (
                <option key={property.id} value={property.id}>
                  {property.name} - {property.city}
                </option>
              ))}
            </select>
            <FormFieldError error={errors.propertyId} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="checkInDate">{t('booking.form.checkInDate')}</Label>
              <Input
                id="checkInDate"
                type="date"
                {...register('checkInDate')}
              />
              <FormFieldError error={errors.checkInDate} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="checkOutDate">{t('booking.form.checkOutDate')}</Label>
              <Input
                id="checkOutDate"
                type="date"
                {...register('checkOutDate')}
              />
              <FormFieldError error={errors.checkOutDate} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="numberOfGuests">{t('booking.form.numberOfGuests')}</Label>
            <Input
              id="numberOfGuests"
              type="number"
              {...register('numberOfGuests', { valueAsNumber: true })}
              placeholder={t('booking.form.numberOfGuestsPlaceholder')}
            />
            <FormFieldError error={errors.numberOfGuests} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="specialRequests">{t('booking.form.specialRequests')}</Label>
            <Textarea
              id="specialRequests"
              {...register('specialRequests')}
              placeholder={t('booking.form.specialRequestsPlaceholder')}
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Guest Information */}
      <Card>
        <CardHeader>
          <CardTitle>{t('booking.form.guestInformation')}</CardTitle>
          <CardDescription>{t('booking.form.guestInformationDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="guest.firstName">{t('booking.form.firstName')}</Label>
              <Input
                id="guest.firstName"
                {...register('guest.firstName')}
                placeholder={t('booking.form.firstNamePlaceholder')}
              />
              <FormFieldError error={errors.guest?.firstName} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="guest.lastName">{t('booking.form.lastName')}</Label>
              <Input
                id="guest.lastName"
                {...register('guest.lastName')}
                placeholder={t('booking.form.lastNamePlaceholder')}
              />
              <FormFieldError error={errors.guest?.lastName} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="guest.email">{t('booking.form.email')}</Label>
            <Input
              id="guest.email"
              type="email"
              {...register('guest.email')}
              placeholder={t('booking.form.emailPlaceholder')}
            />
            <FormFieldError error={errors.guest?.email} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="guest.phone">{t('booking.form.phone')}</Label>
              <Input
                id="guest.phone"
                type="tel"
                {...register('guest.phone')}
                placeholder={t('booking.form.phonePlaceholder')}
              />
              <FormFieldError error={errors.guest?.phone} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="guest.country">{t('booking.form.country')}</Label>
              <Input
                id="guest.country"
                {...register('guest.country')}
                placeholder={t('booking.form.countryPlaceholder')}
              />
              <FormFieldError error={errors.guest?.country} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Form Actions */}
      <div className="flex justify-end gap-4">
        <Button type="button" variant="outline" disabled={isLoading}>
          {t('booking.form.cancel')}
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? t('booking.form.saving') : booking ? t('booking.form.update') : t('booking.form.create')}
        </Button>
      </div>
    </form>
  );
}
