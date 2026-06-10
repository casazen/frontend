import { useMemo, useState } from 'react';
import { Link, useOutletContext, useParams, useSearchParams } from 'react-router-dom';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { useOrgPublicProperty } from '@/queries/use-public-org';
import { useCreateDirectBooking } from '@/queries/use-public-booking';
import { ConsentCheckbox } from '@/features/public-booking/components/consent-checkbox';
import { PriceBreakdown } from '@/features/public-booking/components/price-breakdown';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { isDemoMode } from '@/config/demo.config';
import type { DirectBookingResponse, PublicOrgDto } from '@/types';
import { DIRECT_CHECKOUT_CONSENT_VERSION } from '@/types/direct-booking.types';
import { ArrowLeft, Loader2 } from 'lucide-react';

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
}: {
  onSuccess: () => void;
}) {
  return (
    <div className="space-y-4" data-testid="checkout-payment-step">
      <p className="text-sm text-muted-foreground">
        Modalità demo: il pagamento Stripe è simulato localmente.
      </p>
      <Button className="w-full" onClick={onSuccess}>
        Paga ora
      </Button>
    </div>
  );
}

function StripePaymentStep({
  onSuccess,
  onError,
}: {
  onSuccess: () => void;
  onError: (message: string) => void;
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
      onError(error.message ?? 'Pagamento non riuscito');
      return;
    }

    onSuccess();
  };

  return (
    <div className="space-y-4" data-testid="checkout-payment-step">
      <PaymentElement />
      <Button className="w-full" onClick={handlePay} disabled={processing}>
        {processing ? 'Elaborazione…' : 'Paga ora'}
      </Button>
    </div>
  );
}

export function CheckoutPage() {
  const { orgSlug, propertyId } = useParams<{ orgSlug: string; propertyId: string }>();
  const { org } = useOutletContext<PublicBookingContext>();
  const [searchParams] = useSearchParams();
  const checkIn = searchParams.get('checkIn') ?? '';
  const checkOut = searchParams.get('checkOut') ?? '';
  const nights = useMemo(() => nightsBetween(checkIn, checkOut), [checkIn, checkOut]);

  const { data: property, isLoading } = useOrgPublicProperty(orgSlug, propertyId);
  const createBooking = useCreateDirectBooking();

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

  const handleCreateBooking = async () => {
    if (!propertyId || !checkIn || !checkOut || nights <= 0) return;

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
      });
      setBookingResult(result);
    } catch {
      setPaymentError('Impossibile avviare il checkout. Verifica i dati e riprova.');
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
    return (
      <div className="mx-auto max-w-lg space-y-4 text-center" data-testid="checkout-confirmation">
        <h2 className="text-2xl font-bold">Prenotazione confermata</h2>
        <p className="text-muted-foreground">
          Grazie! Il tuo soggiorno presso {org.displayName} è confermato.
        </p>
        <p className="font-mono text-sm">Riferimento: {bookingResult.bookingId}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-6" data-testid="direct-checkout-page">
      <Button asChild variant="ghost" className="px-0">
        <Link to={`/book/${orgSlug}/property/${propertyId}`}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Torna alla struttura
        </Link>
      </Button>

      <h2 className="text-2xl font-bold">Checkout — {property?.name ?? 'Struttura'}</h2>

      {checkIn && checkOut && (
        <p className="text-muted-foreground">
          Date: {checkIn} → {checkOut} ({nights} notte{nights !== 1 ? 'i' : ''})
        </p>
      )}

      {!bookingResult ? (
        <div className="space-y-4" data-testid="checkout-guest-step">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="firstName">Nome</Label>
              <Input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Cognome</Label>
              <Input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Telefono</Label>
            <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="adults">Adulti</Label>
              <Input
                id="adults"
                type="number"
                min={1}
                value={adults}
                onChange={(e) => setAdults(Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="children">Bambini</Label>
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
              createBooking.isPending
            }
            onClick={handleCreateBooking}
          >
            {createBooking.isPending ? 'Preparazione pagamento…' : 'Continua al pagamento'}
          </Button>
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

          {isDemoMode ? (
            <DemoPaymentStep onSuccess={() => setConfirmed(true)} />
          ) : stripePromise ? (
            <Elements stripe={stripePromise} options={{ clientSecret: bookingResult.clientSecret }}>
              <StripePaymentStep
                onSuccess={() => setConfirmed(true)}
                onError={setPaymentError}
              />
            </Elements>
          ) : null}

          {paymentError && <p className="text-sm text-destructive">{paymentError}</p>}
        </div>
      )}
    </div>
  );
}
