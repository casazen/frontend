import { useTranslation } from 'react-i18next';
import { useFormContext, useWatch } from 'react-hook-form';
import { IdCard } from 'lucide-react';
import { WizardSummary, type WizardSummaryItem } from '@/components/shared/wizard/wizard-summary';
import { Alert } from '@/components/ui/alert';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Qty } from '@/components/ui/qty';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ChildrenAgesFields } from '@/features/tourist-tax/components/children-ages-fields';
import { getProblemMessage } from '@/lib/api-errors';
import { addDays, formatStayDate, isStayDate, nightsBetween, todayInRome } from '@/lib/stay-dates';
import { resizeChildrenAges } from '@/lib/tourist-tax';
import { formatCurrency } from '@/lib/utils';
import { useHostBookingQuote } from '@/queries/use-bookings';
import { useProperties } from '@/queries/use-properties';
import type { Property } from '@/types';
import type { DirectBookingQuote } from '@/types/direct-booking.types';
import { NEW_BOOKING_MAX_GUESTS, NEW_BOOKING_STEP, toQuotePayload, type NewBookingValues } from '../lib/new-booking-model';

const NO_PROPERTIES: readonly Property[] = [];

/** The short-rent properties of the host, and the one the values point at. */
function useShortProperties(propertyId: string | undefined) {
  const query = useProperties({ mode: 'short' });
  const list = Array.isArray(query.data) ? query.data : NO_PROPERTIES;
  return { query, list, property: list.find((candidate) => candidate.id === propertyId) };
}

function GuestCountRow({ label, hint, children }: { label: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3">
      <div className="min-w-0 flex-1 basis-40">
        <p className="break-words text-sm font-medium">{label}</p>
        <p className="break-words text-sm text-foreground/70">{hint}</p>
      </div>
      {children}
    </div>
  );
}

interface StayStepProps {
  /** The step was left with the ages of the minors missing: the empty ones are marked until one is chosen. */
  agesMissing: boolean;
  /** An age was chosen or the number of minors changed: what was missing is not any more. */
  onAgesChange: () => void;
}

/**
 * Step 1: the property, the dates and how many people come. The ages of the minors appear only when the tourist tax of the
 * comune depends on them (the quote of the API says so, as it did in the old form).
 */
export function StayStep({ agesMissing, onAgesChange }: StayStepProps) {
  const { t } = useTranslation();
  const {
    register,
    setValue,
    control,
    formState: { errors },
  } = useFormContext<NewBookingValues>();
  const values = useWatch({ control }) as NewBookingValues;
  const { query: propertiesQuery, list: properties, property } = useShortProperties(values.propertyId);

  const payload = toQuotePayload(values);
  const quote = useHostBookingQuote(payload);
  const ageRulesApply = payload !== null && quote.data?.touristTax.ageRulesApply === true;
  const askAges = ageRulesApply && values.minors > 0;
  const ages = resizeChildrenAges(values.childrenAges ?? [], values.minors);

  const today = todayInRome();
  const minCheckOut = addDays(isStayDate(values.checkInDate) ? values.checkInDate : today, 1);
  const nights = nightsBetween(values.checkInDate, values.checkOutDate);
  const total = values.adults + values.minors;
  const capacity = property && Number.isInteger(property.maxGuests) && property.maxGuests > 0 ? property.maxGuests : null;

  const changeMinors = (next: number) => {
    onAgesChange();
    setValue('minors', next, { shouldDirty: true });
    setValue('childrenAges', resizeChildrenAges(values.childrenAges ?? [], next), { shouldDirty: true });
  };

  return (
    <div className="min-w-0 space-y-6">
      <div className="space-y-2">
        <Field id="propertyId" label={t('booking.create.stay.property')} error={errors.propertyId}>
          {(field) => (
            // Controlled by the form value: the option of a property chosen from the address (or from a draft) exists only once
            // the list is loaded, and the select shows it from then on.
            <Select
              {...field}
              {...register('propertyId')}
              value={values.propertyId ?? ''}
              disabled={propertiesQuery.isLoading || propertiesQuery.isError}
            >
              <option value="">
                {propertiesQuery.isLoading ? t('booking.form.propertiesLoading') : t('booking.create.stay.propertyPlaceholder')}
              </option>
              {properties.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.name} · {candidate.city}
                </option>
              ))}
            </Select>
          )}
        </Field>
        {propertiesQuery.isError && (
          <p role="alert" className="text-sm text-destructive" data-testid="booking-properties-error">
            {t('booking.form.propertiesLoadError')}
          </p>
        )}
        {!propertiesQuery.isLoading && !propertiesQuery.isError && properties.length === 0 && (
          <p className="text-sm text-foreground/70" data-testid="booking-properties-empty">
            {t('booking.form.noProperties')}
          </p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="checkInDate" label={t('booking.create.stay.checkIn')} error={errors.checkInDate}>
          {(field) => <Input {...field} type="date" min={today} {...register('checkInDate')} />}
        </Field>
        <Field
          id="checkOutDate"
          label={t('booking.create.stay.checkOut')}
          error={errors.checkOutDate}
          hint={nights > 0 ? t('booking.create.stay.nights', { count: nights }) : undefined}
        >
          {(field) => <Input {...field} type="date" min={minCheckOut} {...register('checkOutDate')} />}
        </Field>
      </div>

      <fieldset className="min-w-0 space-y-3">
        <legend className="text-sm font-medium">{t('booking.create.stay.guestsTitle')}</legend>
        <div className="divide-y rounded-md border">
          <GuestCountRow label={t('booking.create.stay.adults')} hint={t('booking.create.stay.adultsHint')}>
            <Qty
              label={t('booking.create.stay.adults')}
              value={values.adults}
              min={1}
              max={NEW_BOOKING_MAX_GUESTS - values.minors}
              onChange={(next) => setValue('adults', next, { shouldDirty: true })}
              testId="booking-adults"
            />
          </GuestCountRow>
          <GuestCountRow label={t('booking.create.stay.minors')} hint={t('booking.create.stay.minorsHint')}>
            <Qty
              label={t('booking.create.stay.minors')}
              value={values.minors}
              min={0}
              max={NEW_BOOKING_MAX_GUESTS - values.adults}
              onChange={changeMinors}
              testId="booking-minors"
            />
          </GuestCountRow>
        </div>
        {ageRulesApply && <p className="text-sm text-foreground/70">{t('booking.form.numberOfChildrenHint')}</p>}
        {capacity !== null &&
          (total > capacity ? (
            <Alert variant="warning" data-testid="booking-over-capacity">
              {t('booking.create.stay.overCapacity', { count: capacity })}
            </Alert>
          ) : (
            <p className="text-sm text-foreground/70">{t('booking.create.stay.capacity', { count: capacity })}</p>
          ))}
      </fieldset>

      {askAges && (
        <ChildrenAgesFields
          ages={ages}
          idPrefix="booking"
          showMissing={agesMissing}
          onChange={(next) => {
            onAgesChange();
            setValue('childrenAges', next, { shouldDirty: true });
          }}
        />
      )}
    </div>
  );
}

/**
 * Step 2: how to reach the guest who booked. The API asks for every field of the contact; the documents and the data of all
 * the guests are filled in by them with the online check-in. The browser must not offer the host's own data here.
 */
export function GuestStep() {
  const { t } = useTranslation();
  const {
    register,
    control,
    formState: { errors },
  } = useFormContext<NewBookingValues>();
  const notes = useWatch({ control, name: 'specialRequests' }) ?? '';

  return (
    <div className="min-w-0 space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="guest.firstName" label={t('booking.create.guest.firstName')} error={errors.guest?.firstName}>
          {(field) => <Input {...field} autoComplete="off" {...register('guest.firstName')} />}
        </Field>
        <Field id="guest.lastName" label={t('booking.create.guest.lastName')} error={errors.guest?.lastName}>
          {(field) => <Input {...field} autoComplete="off" {...register('guest.lastName')} />}
        </Field>
      </div>
      <Field
        id="guest.email"
        label={t('booking.create.guest.email')}
        hint={t('booking.create.guest.emailHint')}
        example={t('booking.create.guest.emailExample')}
        error={errors.guest?.email}
      >
        {(field) => <Input {...field} type="email" inputMode="email" autoComplete="off" {...register('guest.email')} />}
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="guest.phone" label={t('booking.create.guest.phone')} example={t('booking.create.guest.phoneExample')} error={errors.guest?.phone}>
          {(field) => <Input {...field} type="tel" inputMode="tel" autoComplete="off" {...register('guest.phone')} />}
        </Field>
        <Field id="guest.country" label={t('booking.create.guest.country')} example={t('booking.create.guest.countryExample')} error={errors.guest?.country}>
          {(field) => <Input {...field} autoComplete="off" {...register('guest.country')} />}
        </Field>
      </div>
      <Field
        id="specialRequests"
        label={t('booking.create.guest.notes')}
        hint={t('booking.create.guest.notesHint')}
        counter={`${notes.length}/1000`}
        optional
        error={errors.specialRequests}
      >
        {(field) => <Textarea {...field} rows={3} maxLength={1000} {...register('specialRequests')} />}
      </Field>
      <p className="flex items-start gap-2 text-sm text-foreground/70">
        <IdCard aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        <span className="min-w-0 break-words">{t('booking.create.guest.checkinNote')}</span>
      </p>
    </div>
  );
}

/** The price the API will record for the stay: lodging, cleaning and tourist tax, never an amount invented here. */
function PriceBlock({ hasStay, quote, isLoading, error }: { hasStay: boolean; quote?: DirectBookingQuote; isLoading: boolean; error: string | null }) {
  const { t } = useTranslation();

  if (!hasStay) {
    return (
      <Alert variant="warning" data-testid="booking-price-missing">
        {t('booking.create.summary.stayMissing')}
      </Alert>
    );
  }
  if (error) {
    return (
      <Alert variant="danger" data-testid="booking-price-error">
        {error}
      </Alert>
    );
  }
  if (!quote) {
    return isLoading ? (
      <p role="status" className="text-sm text-foreground/70" data-testid="booking-price-loading">
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
    <dl className="min-w-0 space-y-2 rounded-lg bg-muted p-4 text-sm" data-testid="booking-price-summary">
      <div className="flex min-w-0 justify-between gap-3">
        <dt className="min-w-0 break-words text-foreground/70">
          {t('booking.form.price.lodging', { count: quote.nights, perNight: money(quote.nightlyRate) })}
        </dt>
        <dd className="shrink-0">{money(quote.lodgingTotal)}</dd>
      </div>
      <div className="flex min-w-0 justify-between gap-3">
        <dt className="min-w-0 break-words text-foreground/70">{t('booking.form.price.cleaning')}</dt>
        <dd className="shrink-0">{money(quote.cleaningFee)}</dd>
      </div>
      <div className="flex min-w-0 justify-between gap-3">
        <dt className="min-w-0 break-words text-foreground/70">{t('booking.form.price.touristTax')}</dt>
        <dd className="min-w-0 text-right" data-testid="booking-price-tax">
          {taxText}
        </dd>
      </div>
      <div className="flex min-w-0 items-baseline justify-between gap-3 border-t pt-3">
        <dt className="font-semibold">{t('booking.form.price.total')}</dt>
        <dd className="text-2xl font-bold" data-testid="booking-price-total">
          {money(quote.totalPrice)}
        </dd>
      </div>
    </dl>
  );
}

/**
 * Step 3: the price the API calculated, what was answered (each block with its "Edit" back to the step) and the note on what
 * a booking entered by hand is. The button of the wizard creates it.
 */
export function SummaryStep() {
  const { t, i18n } = useTranslation();
  const { control } = useFormContext<NewBookingValues>();
  const values = useWatch({ control }) as NewBookingValues;
  const { property } = useShortProperties(values.propertyId);

  const payload = toQuotePayload(values);
  const quote = useHostBookingQuote(payload);

  const nights = nightsBetween(values.checkInDate, values.checkOutDate);
  const dates =
    nights > 0
      ? t('booking.create.summary.datesValue', {
          from: formatStayDate(values.checkInDate, i18n.language),
          to: formatStayDate(values.checkOutDate, i18n.language),
          count: nights,
        })
      : null;
  const guests = [
    t('booking.create.summary.adults', { count: values.adults }),
    ...(values.minors > 0 ? [t('booking.create.summary.minors', { count: values.minors })] : []),
  ].join(', ');
  const guest = values.guest;
  const name = [guest?.firstName, guest?.lastName].map((part) => part?.trim()).filter(Boolean).join(' ');
  const contact = [guest?.email?.trim(), guest?.phone?.trim(), guest?.country?.trim()].filter(Boolean).join(' · ');
  const notes = values.specialRequests?.trim();

  const items: WizardSummaryItem[] = [
    { id: 'property', label: t('booking.create.summary.property'), value: property ? `${property.name} · ${property.city}` : null, stepId: NEW_BOOKING_STEP.stay },
    { id: 'dates', label: t('booking.create.summary.dates'), value: dates, stepId: NEW_BOOKING_STEP.stay },
    { id: 'guests', label: t('booking.create.summary.guests'), value: guests, stepId: NEW_BOOKING_STEP.stay },
    { id: 'guest', label: t('booking.create.summary.guest'), value: name, stepId: NEW_BOOKING_STEP.guest },
    { id: 'contact', label: t('booking.create.summary.contact'), value: contact, stepId: NEW_BOOKING_STEP.guest },
    ...(notes ? [{ id: 'notes', label: t('booking.create.summary.notes'), value: notes, stepId: NEW_BOOKING_STEP.guest }] : []),
  ];

  return (
    <div className="min-w-0 space-y-6">
      <PriceBlock
        hasStay={payload !== null}
        quote={payload ? quote.data : undefined}
        isLoading={quote.isLoading}
        error={payload && quote.isError ? (getProblemMessage(quote.error, t) ?? t('booking.form.price.loadError')) : null}
      />
      <WizardSummary items={items} />
      <Alert variant="info" data-testid="booking-manual-notice">
        {t('booking.form.manualNotice')}
      </Alert>
    </div>
  );
}
