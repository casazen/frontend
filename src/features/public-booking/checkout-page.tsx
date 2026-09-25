import { useMemo, useState, useEffect } from 'react';
import { Link, useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useOrgPublicProperty } from '@/queries/use-public-org';
import { useCreateDirectBooking, useDirectBookingQuote } from '@/queries/use-public-booking';
import { ConsentCheckbox } from '@/features/public-booking/components/consent-checkbox';
import { PriceBreakdown } from '@/features/public-booking/components/price-breakdown';
import { StripeIntentPayment } from '@/features/public-booking/components/stripe-intent-payment';
import { createCheckoutSchema, type CheckoutFormValues } from '@/features/public-booking/schemas/checkout.schema';
import type { ClientPaymentStatus } from '@/features/public-booking/checkout-outcome';
import type { CheckoutOutcomeLocationState } from '@/features/public-booking/checkout-outcome-page';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FormFieldError } from '@/components/shared/form-field-error';
import { isDemoMode } from '@/config/demo.config';
import { getProblemCode, getProblemMessage } from '@/lib/api-errors';
import { buildCheckoutOutcomePath, buildOrgBookingPath, buildPropertyPageUrl } from '@/lib/booking-url';
import { getCountryOptions } from '@/lib/countries';
import { findPendingCheckout, savePendingCheckout, type PendingCheckout } from '@/lib/pending-checkout';
import { addDays, formatStayDate, isStayDate, nightsBetween, todayInRome } from '@/lib/stay-dates';
import { completeChildrenAges, resizeChildrenAges } from '@/lib/tourist-tax';
import { ChildrenAgesFields } from '@/features/tourist-tax/components/children-ages-fields';
import type {
  DirectBookingQuotePayload,
  DirectBookingResponse,
  PublicOrgDto,
  PublicPropertyDetailDto,
  PaymentOption,
} from '@/types';
import { DIRECT_CHECKOUT_CONSENT_VERSION } from '@/types/direct-booking.types';
import { Loader2, RefreshCw } from 'lucide-react';
import { isAxiosError } from 'axios';
import { PublicBreadcrumb } from '@/features/public-site/components/PublicBreadcrumb';
import { useBookingSearchParams } from '@/features/public-site/hooks/use-booking-search-params';

interface PublicBookingContext {
  org: PublicOrgDto;
}

/** Demo builds only (`VITE_DEMO_MODE`): no Stripe; the outcome page still reads the state from the (mocked) API. */
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
  const navigate = useNavigate();
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
  const [paymentError, setPaymentError] = useState<string | null>(null);
  // A 409 on dates this tab has already booked: the guest's own hold (A3-15), offered back instead of a dead end.
  const [ownPendingCheckout, setOwnPendingCheckout] = useState<PendingCheckout | null>(null);
  // Age of each minor at check-in, asked only when the tourist tax of the comune depends on it (BK-03).
  const [childrenAgesState, setChildrenAges] = useState<(number | null)[]>([]);

  const values = watch();
  const { checkIn, checkOut, adults, children } = values;
  // Computed from the current values: RHF's isValid can be overwritten by a slower validation run.
  const formValid = schema.safeParse(values).success;
  const nights = nightsBetween(checkIn, checkOut);
  const guestCountsValid = isValidGuestCount(adults, children);
  const childrenAges = resizeChildrenAges(childrenAgesState, guestCountsValid ? children : 0);
  const completeAges = completeChildrenAges(childrenAges);

  // The price shown is only the backend's (R-05): the same calculation the booking records and charges.
  const stayQuotable =
    isStayDate(checkIn) &&
    isStayDate(checkOut) &&
    checkOut > checkIn &&
    checkIn >= today &&
    guestCountsValid &&
    adults + children <= property.maxGuests;
  const quotePayload: DirectBookingQuotePayload | null = stayQuotable
    ? {
        propertyId: property.id,
        checkInDate: checkIn,
        checkOutDate: checkOut,
        numberOfAdults: adults,
        numberOfChildren: children,
        ...(completeAges ? { childrenAges: completeAges } : {}),
      }
    : null;
  const quote = useDirectBookingQuote(quotePayload);
  const quoteData = quotePayload ? quote.data : undefined;
  const askChildrenAges = children > 0 && quoteData?.touristTax.ageRulesApply === true;
  const childrenAgesMissing = askChildrenAges && !completeAges;
  const quoteReady =
    !!quoteData && !quote.isFetching && !quote.isError && quoteData.touristTax.status !== 'ChildAgesRequired';
  // A3-16: the backend says which options apply to this stay. "Paga alla scadenza" only when its charge day is ahead
  // (not for 10 nights from tomorrow); "Cancellazione gratuita" only if the guest can really cancel (today they cannot).
  const paymentOptions = quoteData?.paymentOptions;
  const deferredChargeDate =
    paymentOptions?.deferredPaymentAvailable === true ? paymentOptions.deferredChargeDate : null;
  const freeCancellationUntil = paymentOptions?.freeCancellationUntil ?? null;

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

  // The stay changed and "Paga alla scadenza" no longer applies: the guest chooses again.
  const deferredUnavailable = paymentOption === 'OnCancellationDeadline' && !!quoteData && !deferredChargeDate;
  useEffect(() => {
    if (deferredUnavailable) setPaymentOption(null);
  }, [deferredUnavailable]);

  /**
   * The outcome page of the booking (BK-07): the real state from the backend, never "confirmed" before the confirmation.
   * Also the Stripe `return_url`, so a redirect method brings the guest back to this booking.
   */
  const outcomePath = bookingResult
    ? buildCheckoutOutcomePath(orgSlug, bookingResult.bookingId, bookingResult.checkoutToken)
    : '';
  const goToOutcome = (state: CheckoutOutcomeLocationState, path = outcomePath) => navigate(path, { state });

  const onSubmit = handleSubmit(async (data) => {
    if (!paymentOption) return;

    setPaymentError(null);
    setOwnPendingCheckout(null);
    try {
      const result = await createBooking.mutateAsync({
        propertyId: property.id,
        checkInDate: data.checkIn,
        checkOutDate: data.checkOut,
        numberOfAdults: data.adults,
        numberOfChildren: data.children,
        ...(askChildrenAges && completeAges ? { childrenAges: completeAges } : {}),
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
      savePendingCheckout({
        bookingId: result.bookingId,
        token: result.checkoutToken,
        orgSlug,
        propertyId: property.id,
        checkIn: data.checkIn,
        checkOut: data.checkOut,
      });

      // "Pay at the property" is a request waiting for the email confirmation and the host (D5): nothing to pay here.
      if (result.paymentOption === 'OnSite') {
        goToOutcome(
          { guestEmail: data.email },
          buildCheckoutOutcomePath(orgSlug, result.bookingId, result.checkoutToken),
        );
        return;
      }
      setBookingResult(result);
    } catch (error) {
      // Every checkout error has its own message (code of the backend ProblemDetails).
      setPaymentError(getProblemMessage(error, t) ?? t('publicBooking.checkoutError'));
      if (isAxiosError(error) && getProblemCode(error.response?.data) === 'booking_dates_unavailable') {
        setOwnPendingCheckout(findPendingCheckout(property.id, data.checkIn, data.checkOut));
      }
    }
  });

  const onPaymentSubmitted = (clientStatus: ClientPaymentStatus) => goToOutcome({ clientStatus });
  const freeCancellationDate = freeCancellationUntil
    ? formatStayDate(freeCancellationUntil, i18n.language, { month: 'long', day: 'numeric' })
    : '';
  const deferredChargeLabel = deferredChargeDate
    ? formatStayDate(deferredChargeDate, i18n.language, { day: 'numeric', month: 'long' })
    : '';

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
            {askChildrenAges && (
              <ChildrenAgesFields
                ages={childrenAges}
                idPrefix="checkout"
                onChange={(next) => {
                  setPaymentError(null);
                  setChildrenAges(next);
                }}
              />
            )}
          </fieldset>

          {!paymentOption ? (
            <div className="space-y-4 border rounded-lg p-4 bg-card">
              <div className="space-y-2">
                <h3 className="font-semibold">{t('publicBooking.paymentMethodTitle')}</h3>
                {freeCancellationDate && (
                  <p className="text-sm text-muted-foreground" data-testid="checkout-free-cancellation">
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
                {deferredChargeLabel && (
                  <button
                    type="button"
                    onClick={() => setPaymentOption('OnCancellationDeadline')}
                    className="w-full p-3 border-2 border-orange-200 rounded-lg hover:bg-orange-50 text-left font-medium transition"
                  >
                    {t('publicBooking.payOnDeadline', { date: deferredChargeLabel })}
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

            {quotePayload &&
              (quote.isError ? (
                <div
                  className="space-y-2 rounded-lg border border-destructive/40 p-4 text-sm"
                  role="alert"
                  data-testid="checkout-quote-error"
                >
                  <p className="text-destructive">
                    {getProblemMessage(quote.error, t) ?? t('publicBooking.quoteError')}
                  </p>
                  <Button type="button" variant="outline" size="sm" onClick={() => void quote.refetch()}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    {t('publicBooking.quoteRetry')}
                  </Button>
                </div>
              ) : quoteData ? (
                <PriceBreakdown
                  nights={quoteData.nights}
                  nightlyRate={quoteData.nightlyRate}
                  cleaningFee={quoteData.cleaningFee}
                  touristTax={quoteData.touristTax}
                  totalAmount={quoteData.totalPrice}
                  currency={quoteData.currency}
                />
              ) : (
                <div
                  className="flex items-center gap-2 rounded-lg border p-4 text-sm text-muted-foreground"
                  data-testid="checkout-quote-loading"
                >
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t('publicBooking.quoteLoading')}
                </div>
              ))}
            {childrenAgesMissing && (
              <p className="text-xs text-muted-foreground" data-testid="checkout-children-ages-missing">
                {t('publicBooking.childrenAgesMissing')}
              </p>
            )}

            <ConsentCheckbox checked={consent} onCheckedChange={setConsent} />

            {paymentError && (
              <p className="text-sm text-destructive" role="alert" data-testid="checkout-error">
                {paymentError}
              </p>
            )}
            {ownPendingCheckout && (
              <div className="space-y-2 rounded-lg border p-4 text-sm" data-testid="checkout-resume-own-booking">
                <p>{t('publicBooking.outcome.resumeOwnBooking')}</p>
                <Button asChild variant="outline" size="sm">
                  <Link
                    to={buildCheckoutOutcomePath(
                      ownPendingCheckout.orgSlug,
                      ownPendingCheckout.bookingId,
                      ownPendingCheckout.token,
                    )}
                  >
                    {t('publicBooking.outcome.resumeOwnBookingAction')}
                  </Link>
                </Button>
              </div>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={
                !formValid || !consent || !paymentOption || !quoteReady || childrenAgesMissing || createBooking.isPending
              }
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
            touristTax={{
              status: bookingResult.touristTaxStatus ?? 'Calculated',
              amount: bookingResult.touristTaxAmount,
            }}
            totalAmount={bookingResult.amount}
            currency={bookingResult.currency}
          />

          {isDemoMode ? (
            <DemoPaymentStep onSuccess={() => onPaymentSubmitted('succeeded')} t={t} />
          ) : bookingResult.clientSecret || bookingResult.setupIntentClientSecret ? (
            <StripeIntentPayment
              publishableKey={bookingResult.connectedAccountPublishableContext.publishableKey}
              stripeAccountId={bookingResult.connectedAccountPublishableContext.stripeAccountId}
              clientSecret={bookingResult.clientSecret || bookingResult.setupIntentClientSecret || ''}
              mode={bookingResult.clientSecret ? 'payment' : 'setup'}
              returnUrl={`${window.location.origin}${outcomePath}`}
              onSubmitted={onPaymentSubmitted}
              onError={setPaymentError}
            />
          ) : null}

          {paymentError && (
            <p className="text-sm text-destructive" role="alert" data-testid="checkout-payment-error">
              {paymentError}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
