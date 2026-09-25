import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FormFieldError } from '@/components/shared/form-field-error';
import { ChildrenAgesFields } from '@/features/tourist-tax/components/children-ages-fields';
import { bookingFormSchema } from '../schemas/booking.schema';
import { stayDateOf } from '../lib/booking-price';
import { useProperties } from '@/queries/use-properties';
import { useHostBookingQuote } from '@/queries/use-bookings';
import { getProblemMessage } from '@/lib/api-errors';
import { isStayDate } from '@/lib/stay-dates';
import { completeChildrenAges, resizeChildrenAges } from '@/lib/tourist-tax';
import { formatCurrency } from '@/lib/utils';
import type { BookingFormValues } from '../schemas/booking.schema';
import type { Booking, HostBookingQuotePayload } from '@/types';
import type { DirectBookingQuote } from '@/types/direct-booking.types';

/** What the form hands to the page: the values plus the ages of the minors when the tourist tax needs them. */
export interface BookingFormSubmit extends BookingFormValues {
  childrenAges?: number[];
}

interface BookingFormProps {
  /** The booking to change; without it the form creates a new manual booking. */
  booking?: Booking;
  /** Property preselected when the form is opened from a property page. */
  initialPropertyId?: string;
  onSubmit: (data: BookingFormSubmit) => void | Promise<void>;
  /** "Cancel": leaves the form without saving. */
  onCancel: () => void;
  isLoading?: boolean;
  /** Message of the last failed save (e.g. 409 on overlapping dates), shown until the next submit. */
  submitError?: string | null;
}

const selectClassName =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

/**
 * Host booking form (PC-01, PC-07). A new booking asks for the guest's contact; a change only touches dates, guests
 * and notes, and dates and guests are locked for bookings from the booking site or a channel and once the stay has
 * started. The price comes from the backend quote, with the tourist tax of BK-03: when the rates of the comune exempt
 * minors by age, the form asks how many guests are minors and their ages.
 */
export function BookingForm({ booking, initialPropertyId, onSubmit, onCancel, isLoading, submitError }: BookingFormProps) {
  const { t } = useTranslation();
  const mode = booking ? 'edit' : 'create';
  const stayLocked =
    !!booking && (booking.source !== 'Manual' || booking.status === 'CheckedIn' || booking.status === 'CheckedOut');

  const {
    data: propertiesData,
    isLoading: propertiesLoading,
    isError: propertiesError,
  } = useProperties();
  const properties = propertiesData ?? [];
  const noProperties = !propertiesLoading && !propertiesError && properties.length === 0;

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<BookingFormValues>({
    resolver: zodResolver(bookingFormSchema(mode)),
    defaultValues: booking
      ? {
          propertyId: booking.propertyId,
          checkInDate: stayDateOf(booking.checkInDate),
          checkOutDate: stayDateOf(booking.checkOutDate),
          numberOfGuests: booking.numberOfGuests,
          numberOfChildren: booking.numberOfChildren ?? 0,
          specialRequests: booking.specialRequests ?? '',
        }
      : { propertyId: initialPropertyId ?? '', numberOfChildren: 0, specialRequests: '' },
  });

  // Age of each minor at check-in, asked only when the tourist tax of the comune depends on it (BK-03).
  const [childrenAgesState, setChildrenAges] = useState<(number | null)[]>([]);
  const [showAgesMissing, setShowAgesMissing] = useState(false);

  const [propertyId, checkInDate, checkOutDate, numberOfGuests, numberOfChildren] = useWatch({
    control,
    name: ['propertyId', 'checkInDate', 'checkOutDate', 'numberOfGuests', 'numberOfChildren'],
  });
  const guestsValid =
    Number.isInteger(numberOfGuests) &&
    numberOfGuests >= 1 &&
    Number.isInteger(numberOfChildren) &&
    numberOfChildren >= 0 &&
    numberOfChildren < numberOfGuests;
  const childrenAges = resizeChildrenAges(childrenAgesState, guestsValid ? numberOfChildren : 0);
  const completeAges = completeChildrenAges(childrenAges);

  const quotePayload: HostBookingQuotePayload | null =
    !stayLocked &&
    !!propertyId &&
    isStayDate(checkInDate ?? '') &&
    isStayDate(checkOutDate ?? '') &&
    checkOutDate > checkInDate &&
    guestsValid
      ? {
          propertyId,
          checkInDate,
          checkOutDate,
          numberOfGuests,
          numberOfChildren,
          ...(completeAges ? { childrenAges: completeAges } : {}),
        }
      : null;
  const quote = useHostBookingQuote(quotePayload);
  const quoteData = quotePayload ? quote.data : undefined;
  const ageRulesApply = quoteData?.touristTax.ageRulesApply === true;
  const showChildren = !stayLocked && (ageRulesApply || (Number.isInteger(numberOfChildren) && numberOfChildren > 0));
  const askAges = ageRulesApply && guestsValid && numberOfChildren > 0;

  const submit = handleSubmit(async (values) => {
    if (askAges && !completeAges) {
      setShowAgesMissing(true);
      return;
    }
    setShowAgesMissing(false);
    await onSubmit({ ...values, ...(askAges && completeAges ? { childrenAges: completeAges } : {}) });
  });

  return (
    <form onSubmit={submit} className="space-y-6" noValidate>
      {mode === 'create' && (
        <p
          data-testid="booking-manual-notice"
          className="rounded-md border bg-muted/40 px-4 py-3 text-sm text-muted-foreground"
        >
          {t('booking.form.manualNotice')}
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t('booking.form.bookingDetails')}</CardTitle>
          <CardDescription>{t('booking.form.bookingDetailsDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="propertyId">{t('booking.form.property')}</Label>
            {/* Controlled by the form value, so the preselected property (edit, or "new booking" from a property) is
                shown as soon as its option is loaded. */}
            <select
              id="propertyId"
              {...register('propertyId')}
              value={propertyId ?? ''}
              className={selectClassName}
              disabled={!!booking || propertiesLoading || propertiesError}
            >
              <option value="">
                {propertiesLoading ? t('booking.form.propertiesLoading') : t('booking.form.selectProperty')}
              </option>
              {properties.map((property) => (
                <option key={property.id} value={property.id}>
                  {property.name} - {property.city}
                </option>
              ))}
            </select>
            {propertiesError && (
              <p role="alert" className="text-sm text-destructive" data-testid="booking-properties-error">
                {t('booking.form.propertiesLoadError')}
              </p>
            )}
            {noProperties && (
              <p className="text-sm text-muted-foreground" data-testid="booking-properties-empty">
                {t('booking.form.noProperties')}
              </p>
            )}
            <FormFieldError error={errors.propertyId} />
          </div>

          {stayLocked && (
            <p className="rounded-md border bg-muted/40 px-4 py-3 text-sm text-muted-foreground" data-testid="booking-stay-locked">
              {booking?.source !== 'Manual' ? t('booking.form.stayLockedSource') : t('booking.form.stayLockedStarted')}
            </p>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="checkInDate">{t('booking.form.checkInDate')}</Label>
              <Input id="checkInDate" type="date" disabled={stayLocked} {...register('checkInDate')} />
              <FormFieldError error={errors.checkInDate} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="checkOutDate">{t('booking.form.checkOutDate')}</Label>
              <Input id="checkOutDate" type="date" disabled={stayLocked} {...register('checkOutDate')} />
              <FormFieldError error={errors.checkOutDate} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="numberOfGuests">{t('booking.form.numberOfGuests')}</Label>
              <Input
                id="numberOfGuests"
                type="number"
                min={1}
                disabled={stayLocked}
                {...register('numberOfGuests', { valueAsNumber: true })}
                placeholder={t('booking.form.numberOfGuestsPlaceholder')}
              />
              <FormFieldError error={errors.numberOfGuests} />
            </div>

            {showChildren && (
              <div className="space-y-2">
                <Label htmlFor="numberOfChildren">{t('booking.form.numberOfChildren')}</Label>
                <Input
                  id="numberOfChildren"
                  type="number"
                  min={0}
                  {...register('numberOfChildren', { valueAsNumber: true })}
                />
                <p className="text-xs text-muted-foreground">{t('booking.form.numberOfChildrenHint')}</p>
                <FormFieldError error={errors.numberOfChildren} />
              </div>
            )}
          </div>

          {askAges && (
            <div className="space-y-2">
              <ChildrenAgesFields
                ages={childrenAges}
                idPrefix="booking"
                showMissing={showAgesMissing}
                onChange={(next) => {
                  setShowAgesMissing(false);
                  setChildrenAges(next);
                }}
              />
              {showAgesMissing && (
                <p role="alert" className="text-sm text-destructive" data-testid="booking-ages-missing">
                  {t('booking.form.childrenAgesMissing')}
                </p>
              )}
            </div>
          )}

          {quotePayload && (
            <StayPriceSummary
              quote={quoteData}
              isLoading={quote.isLoading}
              error={quote.isError ? (getProblemMessage(quote.error, t) ?? t('booking.form.price.loadError')) : null}
            />
          )}

          {booking && !stayLocked && (
            <p className="text-xs text-muted-foreground" data-testid="booking-reprice-notice">
              {t('booking.form.repriceNotice')}
            </p>
          )}

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

      {mode === 'create' && (
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
      )}

      {submitError && (
        <div
          role="alert"
          data-testid="booking-submit-error"
          className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {submitError}
        </div>
      )}

      <div className="flex justify-end gap-4">
        <Button type="button" variant="outline" disabled={isLoading} onClick={onCancel}>
          {t('booking.form.cancel')}
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? t('booking.form.saving') : booking ? t('booking.form.update') : t('booking.form.create')}
        </Button>
      </div>
    </form>
  );
}

interface StayPriceSummaryProps {
  quote?: DirectBookingQuote;
  isLoading: boolean;
  error: string | null;
}

/** Price the backend will record for the stay: lodging, cleaning, tourist tax (never an invented amount). */
function StayPriceSummary({ quote, isLoading, error }: StayPriceSummaryProps) {
  const { t } = useTranslation();

  if (error) {
    return (
      <p role="alert" className="text-sm text-destructive" data-testid="booking-price-error">
        {error}
      </p>
    );
  }
  if (!quote) {
    return isLoading ? (
      <p className="text-sm text-muted-foreground" data-testid="booking-price-loading">
        {t('booking.form.price.loading')}
      </p>
    ) : null;
  }

  const money = (value: number) => formatCurrency(value, quote.currency);
  const tax = quote.touristTax;
  const taxText =
    tax.status === 'Calculated'
      ? money(tax.amount ?? 0)
      : tax.status === 'ChildAgesRequired'
        ? t('booking.form.price.taxNeedsAges')
        : t('booking.form.price.taxNotCalculated');

  return (
    <dl className="rounded-lg bg-muted p-4 space-y-1 text-sm" data-testid="booking-price-summary">
      <div className="flex justify-between">
        <dt className="text-muted-foreground">
          {t('booking.form.price.lodging', { count: quote.nights, perNight: money(quote.nightlyRate) })}
        </dt>
        <dd>{money(quote.lodgingTotal)}</dd>
      </div>
      <div className="flex justify-between">
        <dt className="text-muted-foreground">{t('booking.form.price.cleaning')}</dt>
        <dd>{money(quote.cleaningFee)}</dd>
      </div>
      <div className="flex justify-between">
        <dt className="text-muted-foreground">{t('booking.form.price.touristTax')}</dt>
        <dd data-testid="booking-price-tax">{taxText}</dd>
      </div>
      <div className="flex justify-between border-t pt-1 font-semibold">
        <dt>{t('booking.form.price.total')}</dt>
        <dd data-testid="booking-price-total">{money(quote.totalPrice)}</dd>
      </div>
    </dl>
  );
}
