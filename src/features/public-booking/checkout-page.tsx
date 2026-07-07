import { useMemo, useState, useEffect } from 'react';
import { Link, useOutletContext, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { useOrgPublicProperty } from '@/queries/use-public-org';
import { useCreateDirectBooking } from '@/queries/use-public-booking';
import { publicBookingApi } from '@/api/public-booking.api';
import { ConsentCheckbox } from '@/features/public-booking/components/consent-checkbox';
import { PriceBreakdown } from '@/features/public-booking/components/price-breakdown';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { isDemoMode } from '@/config/demo.config';
import type { DirectBookingResponse, PublicOrgDto, PaymentOption } from '@/types';
import { DIRECT_CHECKOUT_CONSENT_VERSION } from '@/types/direct-booking.types';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { PublicBreadcrumb } from '@/features/public-site/components/PublicBreadcrumb';
import { useBookingSearchParams } from '@/features/public-site/hooks/use-booking-search-params';

interface PublicBookingContext {
  org: PublicOrgDto;
}

function nightsBetween(checkIn: string, checkOut: string): number {
  if (!checkIn || !checkOut) return 0;
  const diff = new Date(checkOut).getTime() - new Date(checkIn).getTime();
  return diff > 0 ? Math.ceil(diff / (1000 * 60 * 60 * 24)) : 0;
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
      case 'OnSite':
        return t('publicBooking.payOnSite');
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
            {t('publicBooking.freeCancellationUntil', { days: daysUntilDeadline(bookingResult.freeRefundDeadline) })}
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

export function CheckoutPage() {
  const { t, i18n } = useTranslation();
  const { orgSlug, propertyId } = useParams<{ orgSlug: string; propertyId: string }>();
  const { org } = useOutletContext<PublicBookingContext>();
  const { params, toQueryString } = useBookingSearchParams();
  const checkIn = params.checkIn;
  const checkOut = params.checkOut;
  const nights = useMemo(() => nightsBetween(checkIn, checkOut), [checkIn, checkOut]);

  const { data: property, isLoading } = useOrgPublicProperty(orgSlug, propertyId);
  const createBooking = useCreateDirectBooking();

  const [paymentOption, setPaymentOption] = useState<PaymentOption | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [country] = useState('IT');
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [consent, setConsent] = useState(false);
  const [bookingResult, setBookingResult] = useState<DirectBookingResponse | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

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

  const handleCreateBooking = async () => {
    if (!propertyId || !checkIn || !checkOut || nights <= 0 || !paymentOption) return;

    setPaymentError(null);
    try {
      const result = await createBooking.mutateAsync({
        propertyId,
        checkInDate: checkIn,
        checkOutDate: checkOut,
        numberOfAdults: adults,
        numberOfChildren: children,
        guest: { firstName, lastName, email, phone, country },
        consent: { dataProcessing: true, consentVersion: DIRECT_CHECKOUT_CONSENT_VERSION },
        paymentOption,
      });
      setBookingResult(result);

      if (paymentOption === 'OnSite') {
        setConfirmed(true);
      }
    } catch {
      setPaymentError(t('publicBooking.checkoutError'));
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (confirmed && bookingResult) {
    return <ConfirmationScreen bookingResult={bookingResult} org={org} orgSlug={orgSlug} t={t} i18n={i18n} />;
  }

  const basePath = `/book/${orgSlug}`;
  const propertyQuery = toQueryString();

  return (
    <div className="mx-auto max-w-lg space-y-6" data-testid="direct-checkout-page">
      <PublicBreadcrumb
        segments={[
          { label: org.displayName, href: basePath },
          { label: property?.name ?? t('publicBooking.propertyFallback'), href: `${basePath}/property/${propertyId}${propertyQuery}` },
          { label: t('publicSite.breadcrumbCheckout') },
        ]}
      />

      <h2 className="text-2xl font-bold">{t('publicBooking.checkoutTitle', { propertyName: property?.name ?? 'Struttura' })}</h2>

      {checkIn && checkOut && (
        <p className="text-muted-foreground">
          {t('publicBooking.checkoutDates', { checkIn, checkOut, nights, plural: nights !== 1 ? 'i' : '' })}
        </p>
      )}

      {!bookingResult ? (
        <div className="space-y-6" data-testid="checkout-guest-step">
          {!paymentOption ? (
            <div className="space-y-4 border rounded-lg p-4 bg-card">
              <div className="space-y-2">
                <h3 className="font-semibold">{t('publicBooking.paymentMethodTitle')}</h3>
                <p className="text-sm text-muted-foreground">
                  {t('publicBooking.freeCancellationBy', {
                    date: new Date(new Date(checkIn).getTime() - 7 * 24 * 60 * 60 * 1000).toLocaleDateString(i18n.language, { month: 'long', day: 'numeric' })
                  })}
                </p>
              </div>
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setPaymentOption('Immediate')}
                  className="w-full p-3 border-2 border-primary rounded-lg bg-primary/5 hover:bg-primary/10 text-left font-medium transition"
                >
                  {t('publicBooking.payImmediately')}
                </button>
                {nights > 7 && (
                  <button
                    type="button"
                    onClick={() => setPaymentOption('OnCancellationDeadline')}
                    className="w-full p-3 border-2 border-orange-200 rounded-lg hover:bg-orange-50 text-left font-medium transition"
                  >
                    {t('publicBooking.payOnDeadline', {
                      date: new Date(new Date(checkIn).getTime() - 7 * 24 * 60 * 60 * 1000).toLocaleDateString(i18n.language, { month: 'short', day: 'numeric' })
                    })}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setPaymentOption('OnSite')}
                  className="w-full p-3 border-2 border-purple-200 rounded-lg hover:bg-purple-50 text-left font-medium transition"
                >
                  {t('publicBooking.payOnSiteOption')}
                </button>
              </div>
            </div>
          ) : (
            <Button variant="outline" onClick={() => setPaymentOption(null)} className="w-full">
              {t('publicBooking.changePaymentMethod')}
            </Button>
          )}

          <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="firstName">{t('publicBooking.firstName')}</Label>
              <Input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">{t('publicBooking.lastName')}</Label>
              <Input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">{t('publicBooking.email')}</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">{t('publicBooking.phone')}</Label>
            <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="adults">{t('publicBooking.adults')}</Label>
              <Input
                id="adults"
                type="number"
                min={1}
                value={adults}
                onChange={(e) => setAdults(Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="children">{t('publicBooking.children')}</Label>
              <Input
                id="children"
                type="number"
                min={0}
                value={children}
                onChange={(e) => setChildren(Number(e.target.value))}
              />
            </div>
          </div>

          {property && nights > 0 && (
            <PriceBreakdown
              nights={nights}
              nightlyRate={property.nightlyRate}
              cleaningFee={property.cleaningFee}
              touristTaxAmount={0}
              totalAmount={property.nightlyRate * nights + property.cleaningFee}
              currency={property.currency ?? 'EUR'}
            />
          )}

          <ConsentCheckbox checked={consent} onCheckedChange={setConsent} />

          {paymentError && <p className="text-sm text-destructive">{paymentError}</p>}

          <Button
            className="w-full"
            disabled={
              !consent ||
              !firstName ||
              !lastName ||
              !email ||
              nights <= 0 ||
              !paymentOption ||
              createBooking.isPending
            }
            onClick={handleCreateBooking}
          >
            {createBooking.isPending ? t('publicBooking.preparingPayment') : t('publicBooking.continue')}
          </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <PriceBreakdown
            nights={nights}
            nightlyRate={property?.nightlyRate ?? 0}
            cleaningFee={property?.cleaningFee ?? 0}
            touristTaxAmount={bookingResult.touristTaxAmount}
            totalAmount={bookingResult.amount}
            currency={bookingResult.currency}
          />

          {bookingResult.paymentOption === 'OnSite' ? (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm font-medium text-green-800">
                ✓ {t('publicBooking.bookingConfirmedOnSite')}
              </p>
            </div>
          ) : isDemoMode ? (
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
