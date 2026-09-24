import { useMemo, useState, useEffect } from 'react';
import { Link, useOutletContext, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { useOrgPublicProperty } from '@/queries/use-public-org';
import { useCreateDirectBooking } from '@/queries/use-public-booking';
import { publicBookingApi } from '@/api/public-booking.api';
import { ConsentCheckbox } from '@/features/public-booking/components/consent-checkbox';
import { PriceBreakdown } from '@/features/public-booking/components/price-breakdown';
import { createCheckoutSchema, type CheckoutFormValues } from '@/features/public-booking/schemas/checkout.schema';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FormFieldError } from '@/components/shared/form-field-error';
import { isDemoMode } from '@/config/demo.config';
import { getProblemMessage } from '@/lib/api-errors';
import { buildOrgBookingPath, buildPropertyPageUrl } from '@/lib/booking-url';
import { getCountryOptions } from '@/lib/countries';
import { addDays, formatRomeDateTime, formatStayDate, nightsBetween, todayInRome } from '@/lib/stay-dates';
import type { DirectBookingResponse, PublicOrgDto, PublicPropertyDetailDto, PaymentOption } from '@/types';
import { DIRECT_CHECKOUT_CONSENT_VERSION } from '@/types/direct-booking.types';
import { Loader2, CheckCircle2, MailCheck } from 'lucide-react';
import { PublicBreadcrumb } from '@/features/public-site/components/PublicBreadcrumb';
import { useBookingSearchParams } from '@/features/public-site/hooks/use-booking-search-params';

interface PublicBookingContext {
  org: PublicOrgDto;
}

function DemoPaymentStep({
  onSuccess,
  t,
}: {
  onSuccess: () => void;
  t: (key: string) => string;
}) {
  return (
    <div className="space-y-4" data-testid="checkout-payment-step">
      <p className="text-sm text-muted-foreground">
        {t('publicBooking.demoPaymentNote')}
      </p>
      <Button className="w-full" onClick={onSuccess}>
        {t('publicBooking.payNow')}
      </Button>
    </div>
  );
}

function StripePaymentStep({
  onSuccess,
  onError,
  t,
}: {
  onSuccess: () => void;
  onError: (message: string) => void;
  t: (key: string) => string;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);

  const handlePay = async () => {
    if (!stripe || !elements) return;

    setProcessing(true);
    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: window.location.href },
      redirect: 'if_required',
    });
    setProcessing(false);

    if (error) {
      onError(error.message ?? t('publicBooking.paymentFailed'));
      return;
    }

    onSuccess();
  };

  return (
    <div className="space-y-4" data-testid="checkout-payment-step">
      <PaymentElement />
      <Button className="w-full" onClick={handlePay} disabled={processing}>
        {processing ? t('publicBooking.processing') : t('publicBooking.payNow')}
      </Button>
    </div>
  );
}

function StripeSetupStep({
  onSuccess,
  onError,
  t,
}: {
  onSuccess: () => void;
  onError: (message: string) => void;
  t: (key: string) => string;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);

  const handleConfirm = async () => {
    if (!stripe || !elements) return;

    setProcessing(true);
    const { error } = await stripe.confirmSetup({
      elements,
      confirmParams: { return_url: window.location.href },
      redirect: 'if_required',
    });
    setProcessing(false);

    if (error) {
      onError(error.message ?? t('publicBooking.paymentSetupError'));
      return;
    }

    onSuccess();
  };

  return (
    <div className="space-y-4" data-testid="checkout-setup-step">
      <PaymentElement />
      <Button className="w-full" onClick={handleConfirm} disabled={processing}>
        {processing ? t('publicBooking.confirming') : t('publicBooking.confirmPaymentSetup')}
      </Button>
    </div>
  );
}

function ConfirmationScreen({
  bookingResult,
  org,
  orgSlug,
  t,
  i18n,
}: {
  bookingResult: DirectBookingResponse;
  org: PublicOrgDto;
  orgSlug: string | undefined;
  t: (key: string, options?: Record<string, unknown>) => string;
  i18n: { language: string };
}) {
  const formatDate = (date: string | Date) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString(i18n.language, { month: 'long', day: 'numeric' });
  };

  const daysUntilDeadline = (deadline: string | Date) => {
    const d = typeof deadline === 'string' ? new Date(deadline) : deadline;
    const today = new Date();
    const diff = d.getTime() - today.getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return days;
  };

  const paymentText = (() => {
    switch (bookingResult.paymentOption) {
      case 'Immediate':
        return t('publicBooking.paidOnline');
      case 'OnCancellationDeadline':
        return t('publicBooking.paymentDueBy', { date: formatDate(bookingResult.freeRefundDeadline) });
      default:
        return '';
    }
  })();

  return (
    <div className="mx-auto max-w-lg space-y-6 text-center" data-testid="checkout-confirmation">
      <div className="flex justify-center">
        <div className="rounded-full bg-green-100 p-4">
          <CheckCircle2 className="h-12 w-12 text-green-600" />
        </div>
      </div>
      <div className="space-y-2">
        <h2 className="text-2xl font-bold">{t('publicBooking.bookingConfirmed')}</h2>
        <p className="text-muted-foreground">
          {t('publicBooking.bookingConfirmedDescription', { orgName: org.displayName })}
        </p>
      </div>
      <div className="bg-card rounded-lg p-4 space-y-2 text-left">
        <p className="text-xs font-medium text-muted-foreground">{t('publicBooking.bookingReference')}</p>
        <p className="font-mono text-lg font-semibold">{bookingResult.bookingId}</p>
      </div>
      <div className="bg-card rounded-lg p-4 space-y-2 text-left">
        <p className="text-xs font-medium text-muted-foreground">{t('publicBooking.paymentMethod')}</p>
        <p className="text-sm">{paymentText}</p>
        {bookingResult.paymentOption === 'OnCancellationDeadline' && (
          <p className="text-xs text-orange-600 mt-2">
            {t('publicBooking.freeCancellationUntil', { count: daysUntilDeadline(bookingResult.freeRefundDeadline) })}
          </p>
        )}
      </div>
      <div className="space-y-2">
        <Link to={`/book/${orgSlug}`} className="block">
          <Button variant="outline" className="w-full">
            {t('publicBooking.backToProperties')}
          </Button>
        </Link>
        <Link to={`/book/${orgSlug}/my-bookings`} className="block">
          <Button className="w-full">
            {t('publicBooking.viewMyBookings')}
          </Button>
        </Link>
      </div>
    </div>
  );
}

/**
 * "Pay at the property" (BK-06, decision D5): the checkout sends a request, never a confirmed booking. The guest confirms
 * the email, then the host accepts or declines.
 */
function OnSiteRequestSentScreen({
  bookingResult,
  org,
  orgSlug,
  guestEmail,
}: {
  bookingResult: DirectBookingResponse;
  org: PublicOrgDto;
  orgSlug: string;
  guestEmail: string;
}) {
  const { t, i18n } = useTranslation();
  const confirmBy = bookingResult.emailConfirmationExpiresAt
    ? formatRomeDateTime(bookingResult.emailConfirmationExpiresAt, i18n.language)
    : '';

  return (
    <div className="mx-auto max-w-lg space-y-6 text-center" data-testid="checkout-onsite-request-sent">
      <div className="flex justify-center">
        <div className="rounded-full bg-amber-100 p-4">
          <MailCheck className="h-12 w-12 text-amber-700" />
        </div>
      </div>
      <div className="space-y-2">
        <h2 className="text-2xl font-bold">{t('publicBooking.onSiteRequest.sentTitle')}</h2>
        <p className="text-muted-foreground">
          {t('publicBooking.onSiteRequest.sentDescription', { orgName: org.displayName })}
        </p>
      </div>
      <div className="bg-card rounded-lg p-4 space-y-2 text-left">
        <p className="font-medium">{t('publicBooking.onSiteRequest.nextStepsTitle')}</p>
        <ol className="list-decimal space-y-2 pl-5 text-sm">
          <li>
            {confirmBy
              ? t('publicBooking.onSiteRequest.stepConfirmEmail', { email: guestEmail, time: confirmBy })
              : t('publicBooking.onSiteRequest.stepConfirmEmailNoTime', { email: guestEmail })}
          </li>
          <li>{t('publicBooking.onSiteRequest.stepHostAnswers')}</li>
          <li>{t('publicBooking.onSiteRequest.stepPayOnSite')}</li>
        </ol>
      </div>
      <div className="bg-card rounded-lg p-4 space-y-2 text-left">
        <p className="text-xs font-medium text-muted-foreground">{t('publicBooking.bookingReference')}</p>
        <p className="font-mono text-lg font-semibold">{bookingResult.bookingId}</p>
      </div>
      <Link to={buildOrgBookingPath(orgSlug)} className="block">
        <Button variant="outline" className="w-full">
          {t('publicBooking.backToProperties')}
        </Button>
      </Link>
    </div>
  );
}

/** At least one adult, no negative or fractional counts (inputs may hold NaN while being edited). */
function isValidGuestCount(adults: number, children: number): boolean {
  return Number.isInteger(adults) && adults >= 1 && Number.isInteger(children) && children >= 0;
}

const selectClassName =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

export function CheckoutPage() {
  const { t } = useTranslation();
  const { orgSlug = '', propertySlugOrId } = useParams<{ orgSlug: string; propertySlugOrId: string }>();
  const { org } = useOutletContext<PublicBookingContext>();
  const { data: property, isLoading, isError } = useOrgPublicProperty(orgSlug, propertySlugOrId);

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isError || !property) {
    return (
      <div className="space-y-4 text-center" data-testid="checkout-property-not-found">
        <p className="text-muted-foreground">{t('publicBooking.propertyNotFound')}</p>
        <Button asChild variant="outline">
          <Link to={buildOrgBookingPath(orgSlug)}>{t('publicBooking.backToProperties')}</Link>
        </Button>
      </div>
    );
  }

  return <CheckoutFlow org={org} orgSlug={orgSlug} property={property} />;
}

function CheckoutFlow({
  org,
  orgSlug,
  property,
}: {
  org: PublicOrgDto;
  orgSlug: string;
  property: PublicPropertyDetailDto;
}) {
  const { t, i18n } = useTranslation();
  const { params, setParams } = useBookingSearchParams();
  const [today] = useState(() => todayInRome());
  const schema = useMemo(
    () => createCheckoutSchema({ maxGuests: property.maxGuests, today }),
    [property.maxGuests, today],
  );
  const {
    register,
    handleSubmit,
    watch,
    trigger,
    getValues,
    formState: { errors },
  } = useForm<CheckoutFormValues>({
    resolver: zodResolver(schema),
    mode: 'onTouched',
    defaultValues: {
      checkIn: params.checkIn,
      checkOut: params.checkOut,
      adults: params.guests - params.children,
      children: params.children,
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      country: '',
    },
  });
  const createBooking = useCreateDirectBooking();
  const countryOptions = useMemo(() => getCountryOptions(i18n.language), [i18n.language]);

  const [paymentOption, setPaymentOption] = useState<PaymentOption | null>(null);
  const [consent, setConsent] = useState(false);
  const [bookingResult, setBookingResult] = useState<DirectBookingResponse | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [requestEmail, setRequestEmail] = useState('');
  const [paymentError, setPaymentError] = useState<string | null>(null);

  const values = watch();
  const { checkIn, checkOut, adults, children } = values;
  // Computed from the current values: RHF's isValid can be overwritten by a slower validation run.
  const formValid = schema.safeParse(values).success;
  const nights = nightsBetween(checkIn, checkOut);
  const guestCountsValid = isValidGuestCount(adults, children);

  // Dates and guests coming from the link are checked right away (past dates, too many guests).
  useEffect(() => {
    const { checkIn: initialCheckIn, checkOut: initialCheckOut } = getValues();
    const fields: (keyof CheckoutFormValues)[] = ['adults'];
    if (initialCheckIn) fields.push('checkIn');
    if (initialCheckOut) fields.push('checkOut');
    void trigger(fields);
  }, [getValues, trigger]);

  /**
   * Keeps the stay in the URL, so the property link and a page reload show the same dates and guests.
   * A server error about the previous stay (e.g. dates not available) no longer applies.
   */
  const syncStayToUrl = () => {
    setPaymentError(null);
    const current = getValues();
    setParams({
      checkIn: current.checkIn,
      checkOut: current.checkOut,
      ...(isValidGuestCount(current.adults, current.children)
        ? { guests: current.adults + current.children, children: current.children }
        : {}),
    });
  };

  const handleCheckInChange = () => {
    syncStayToUrl();
    if (getValues('checkOut')) void trigger('checkOut');
  };
  // The capacity error sits on "adults" and depends on both counts.
  const handleGuestsChange = () => {
    syncStayToUrl();
    void trigger('adults');
  };

  const stripePromise = useMemo(() => {
    if (!bookingResult || isDemoMode) return null;
    const { publishableKey, stripeAccountId } = bookingResult.connectedAccountPublishableContext;
    return loadStripe(publishableKey, { stripeAccount: stripeAccountId });
  }, [bookingResult]);

  useEffect(() => {
    if (confirmed && bookingResult && bookingResult.paymentOption === 'Immediate') {
      let attempts = 0;
      const checkStatus = async () => {
        try {
          const status = await publicBookingApi.getBookingStatus(bookingResult.bookingId);
          if (status.status === 'Confirmed') {
            return;
          }
          attempts++;
          if (attempts < 15) {
            setTimeout(checkStatus, 2000);
          }
        } catch {
          // Continue polling
          attempts++;
          if (attempts < 15) {
            setTimeout(checkStatus, 2000);
          }
        }
      };
      checkStatus();
    }
  }, [confirmed, bookingResult]);

  const onSubmit = handleSubmit(async (data) => {
    if (!paymentOption) return;

    setPaymentError(null);
    try {
      const result = await createBooking.mutateAsync({
        propertyId: property.id,
        checkInDate: data.checkIn,
        checkOutDate: data.checkOut,
        numberOfAdults: data.adults,
        numberOfChildren: data.children,
        guest: {
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
          phone: data.phone,
          country: data.country,
        },
        consent: { dataProcessing: true, consentVersion: DIRECT_CHECKOUT_CONSENT_VERSION },
        paymentOption,
      });
      setBookingResult(result);

      // "Pay at the property" is a request waiting for the email confirmation and the host (D5): nothing to pay here.
      if (result.paymentOption === 'OnSite') {
        setRequestEmail(data.email);
        setConfirmed(true);
      }
    } catch (error) {
      setPaymentError(getProblemMessage(error, t) ?? t('publicBooking.checkoutError'));
    }
  });

  if (confirmed && bookingResult?.paymentOption === 'OnSite') {
    return (
      <OnSiteRequestSentScreen bookingResult={bookingResult} org={org} orgSlug={orgSlug} guestEmail={requestEmail} />
    );
  }

  if (confirmed && bookingResult) {
    return <ConfirmationScreen bookingResult={bookingResult} org={org} orgSlug={orgSlug} t={t} i18n={i18n} />;
  }

  const freeCancellationDate = formatStayDate(addDays(checkIn, -7), i18n.language, { month: 'long', day: 'numeric' });
  const deadlineDate = formatStayDate(addDays(checkIn, -7), i18n.language, { month: 'short', day: 'numeric' });
  const touristTaxEstimate = guestCountsValid ? Math.max(0, nights * adults * 2) : 0;

  return (
    <div className="mx-auto max-w-lg space-y-6" data-testid="direct-checkout-page">
      <PublicBreadcrumb
        segments={[
          { label: org.displayName, href: buildOrgBookingPath(orgSlug) },
          { label: property.name, href: buildPropertyPageUrl(orgSlug, property, params) },
          { label: t('publicSite.breadcrumbCheckout') },
        ]}
      />

      <h2 className="text-2xl font-bold">{t('publicBooking.checkoutTitle', { propertyName: property.name })}</h2>

      {nights > 0 && (
        <p className="text-muted-foreground" data-testid="checkout-stay-summary">
          {t('publicBooking.checkoutDates', {
            checkIn: formatStayDate(checkIn, i18n.language),
            checkOut: formatStayDate(checkOut, i18n.language),
            count: nights,
          })}
        </p>
      )}

      {!bookingResult ? (
        <form className="space-y-6" data-testid="checkout-guest-step" noValidate onSubmit={onSubmit}>
          <fieldset className="space-y-4 rounded-lg border p-4" data-testid="checkout-stay">
            <legend className="px-1 font-semibold">{t('publicBooking.stayTitle')}</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="checkout-check-in">{t('publicBooking.checkInLabel')}</Label>
                <Input
                  id="checkout-check-in"
                  type="date"
                  min={today}
                  aria-invalid={!!errors.checkIn}
                  {...register('checkIn', { onChange: handleCheckInChange })}
                />
                <FormFieldError error={errors.checkIn} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="checkout-check-out">{t('publicBooking.checkOutLabel')}</Label>
                <Input
                  id="checkout-check-out"
                  type="date"
                  min={addDays(checkIn && checkIn >= today ? checkIn : today, 1)}
                  aria-invalid={!!errors.checkOut}
                  {...register('checkOut', { onChange: syncStayToUrl })}
                />
                <FormFieldError error={errors.checkOut} />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="adults">{t('publicBooking.adults')}</Label>
                <Input
                  id="adults"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={property.maxGuests}
                  aria-invalid={!!errors.adults}
                  {...register('adults', { valueAsNumber: true, onChange: handleGuestsChange })}
                />
                <FormFieldError error={errors.adults} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="children">{t('publicBooking.children')}</Label>
                <Input
                  id="children"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={Math.max(0, property.maxGuests - 1)}
                  aria-invalid={!!errors.children}
                  {...register('children', { valueAsNumber: true, onChange: handleGuestsChange })}
                />
                <FormFieldError error={errors.children} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {t('publicBooking.guestsCapacityHint', { count: property.maxGuests })}
            </p>
          </fieldset>

          {!paymentOption ? (
            <div className="space-y-4 border rounded-lg p-4 bg-card">
              <div className="space-y-2">
                <h3 className="font-semibold">{t('publicBooking.paymentMethodTitle')}</h3>
                {freeCancellationDate && (
                  <p className="text-sm text-muted-foreground">
                    {t('publicBooking.freeCancellationBy', { date: freeCancellationDate })}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setPaymentOption('Immediate')}
                  className="w-full p-3 border-2 border-primary rounded-lg bg-primary/5 hover:bg-primary/10 text-left font-medium transition"
                >
                  {t('publicBooking.payImmediately')}
                </button>
                {nights > 7 && deadlineDate && (
                  <button
                    type="button"
                    onClick={() => setPaymentOption('OnCancellationDeadline')}
                    className="w-full p-3 border-2 border-orange-200 rounded-lg hover:bg-orange-50 text-left font-medium transition"
                  >
                    {t('publicBooking.payOnDeadline', { date: deadlineDate })}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setPaymentOption('OnSite')}
                  className="w-full p-3 border-2 border-purple-200 rounded-lg hover:bg-purple-50 text-left font-medium transition"
                >
                  {t('publicBooking.payOnSiteOption')}
                  <span className="block text-xs font-normal text-muted-foreground">
                    {t('publicBooking.onSiteRequest.optionHint')}
                  </span>
                </button>
              </div>
            </div>
          ) : (
            <Button type="button" variant="outline" onClick={() => setPaymentOption(null)} className="w-full">
              {t('publicBooking.changePaymentMethod')}
            </Button>
          )}

          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="firstName">{t('publicBooking.firstName')}</Label>
                <Input id="firstName" autoComplete="given-name" aria-invalid={!!errors.firstName} {...register('firstName')} />
                <FormFieldError error={errors.firstName} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">{t('publicBooking.lastName')}</Label>
                <Input id="lastName" autoComplete="family-name" aria-invalid={!!errors.lastName} {...register('lastName')} />
                <FormFieldError error={errors.lastName} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">{t('publicBooking.email')}</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder={t('publicBooking.emailPlaceholder')}
                aria-invalid={!!errors.email}
                {...register('email')}
              />
              <FormFieldError error={errors.email} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="phone">{t('publicBooking.phone')}</Label>
                <Input id="phone" type="tel" autoComplete="tel" aria-invalid={!!errors.phone} {...register('phone')} />
                <FormFieldError error={errors.phone} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="country">{t('publicBooking.country')}</Label>
                <select
                  id="country"
                  autoComplete="country"
                  className={selectClassName}
                  aria-invalid={!!errors.country}
                  {...register('country')}
                >
                  <option value="">{t('publicBooking.countryPlaceholder')}</option>
                  {countryOptions.map((option) => (
                    <option key={option.code} value={option.code}>
                      {option.name}
                    </option>
                  ))}
                </select>
                <FormFieldError error={errors.country} />
              </div>
            </div>

            {nights > 0 && (
              <PriceBreakdown
                nights={nights}
                nightlyRate={property.nightlyRate}
                cleaningFee={property.cleaningFee}
                touristTaxAmount={touristTaxEstimate}
                totalAmount={property.nightlyRate * nights + property.cleaningFee + touristTaxEstimate}
                currency={property.currency ?? 'EUR'}
              />
            )}

            <ConsentCheckbox checked={consent} onCheckedChange={setConsent} />

            {paymentError && (
              <p className="text-sm text-destructive" role="alert" data-testid="checkout-error">
                {paymentError}
              </p>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={!formValid || !consent || !paymentOption || createBooking.isPending}
            >
              {createBooking.isPending ? t('publicBooking.preparingPayment') : t('publicBooking.continue')}
            </Button>
          </div>
        </form>
      ) : (
        <div className="space-y-4">
          <PriceBreakdown
            nights={nights}
            nightlyRate={property.nightlyRate}
            cleaningFee={property.cleaningFee}
            touristTaxAmount={bookingResult.touristTaxAmount}
            totalAmount={bookingResult.amount}
            currency={bookingResult.currency}
          />

          {isDemoMode ? (
            <DemoPaymentStep onSuccess={() => setConfirmed(true)} t={t} />
          ) : stripePromise && bookingResult.clientSecret ? (
            <Elements stripe={stripePromise} options={{ clientSecret: bookingResult.clientSecret }}>
              <StripePaymentStep
                onSuccess={() => setConfirmed(true)}
                onError={setPaymentError}
                t={t}
              />
            </Elements>
          ) : stripePromise && bookingResult.setupIntentClientSecret ? (
            <Elements stripe={stripePromise} options={{ clientSecret: bookingResult.setupIntentClientSecret }}>
              <StripeSetupStep
                onSuccess={() => setConfirmed(true)}
                onError={setPaymentError}
                t={t}
              />
            </Elements>
          ) : null}

          {paymentError && <p className="text-sm text-destructive">{paymentError}</p>}
        </div>
      )}
    </div>
  );
}
