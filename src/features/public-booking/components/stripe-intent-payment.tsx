import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { Button } from '@/components/ui/button';
import { clientStatusFromIntent, type ClientPaymentStatus } from '@/features/public-booking/checkout-outcome';

export type StripeIntentMode = 'payment' | 'setup';

interface StripeIntentFormProps {
  mode: StripeIntentMode;
  /** Where Stripe sends the guest back after a redirect method: the outcome page of the booking (BK-07). */
  returnUrl: string;
  /** The intent was submitted without a redirect: its status as far as Stripe.js knows (never the booking's). */
  onSubmitted: (status: ClientPaymentStatus) => void;
  onError: (message: string) => void;
}

function StripeIntentForm({ mode, returnUrl, onSubmitted, onError }: StripeIntentFormProps) {
  const { t } = useTranslation();
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);

  const submit = async () => {
    if (!stripe || !elements) return;

    setProcessing(true);
    try {
      if (mode === 'payment') {
        const { error, paymentIntent } = await stripe.confirmPayment({
          elements,
          confirmParams: { return_url: returnUrl },
          redirect: 'if_required',
        });
        if (error) {
          onError(error.message ?? t('publicBooking.paymentFailed'));
          return;
        }
        onSubmitted(clientStatusFromIntent(paymentIntent?.status) ?? 'processing');
      } else {
        const { error, setupIntent } = await stripe.confirmSetup({
          elements,
          confirmParams: { return_url: returnUrl },
          redirect: 'if_required',
        });
        if (error) {
          onError(error.message ?? t('publicBooking.paymentSetupError'));
          return;
        }
        onSubmitted(clientStatusFromIntent(setupIntent?.status) ?? 'processing');
      }
    } finally {
      setProcessing(false);
    }
  };

  const idleLabel = mode === 'payment' ? t('publicBooking.payNow') : t('publicBooking.confirmPaymentSetup');
  const busyLabel = mode === 'payment' ? t('publicBooking.processing') : t('publicBooking.confirming');

  return (
    <div className="space-y-4" data-testid={mode === 'payment' ? 'checkout-payment-step' : 'checkout-setup-step'}>
      <PaymentElement />
      <Button className="w-full" onClick={() => void submit()} disabled={processing || !stripe || !elements}>
        {processing ? busyLabel : idleLabel}
      </Button>
    </div>
  );
}

interface StripeIntentPaymentProps extends StripeIntentFormProps {
  publishableKey: string;
  /** Connected account of the host: the checkout makes direct charges. */
  stripeAccountId: string;
  clientSecret: string;
}

/**
 * Stripe Payment Element for the PaymentIntent ("Paga subito") or the SetupIntent ("Paga alla scadenza") of a booking.
 * Used by the checkout and, to pay the same hold again, by the outcome page.
 */
export function StripeIntentPayment({
  publishableKey,
  stripeAccountId,
  clientSecret,
  ...formProps
}: StripeIntentPaymentProps) {
  const stripePromise = useMemo(
    () => loadStripe(publishableKey, { stripeAccount: stripeAccountId }),
    [publishableKey, stripeAccountId],
  );

  return (
    <Elements stripe={stripePromise} options={{ clientSecret }}>
      <StripeIntentForm {...formProps} />
    </Elements>
  );
}
