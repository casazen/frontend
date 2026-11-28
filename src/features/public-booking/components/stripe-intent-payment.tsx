import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { loadStripe, type Appearance, type StripeElementLocale } from '@stripe/stripe-js';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { Button } from '@/components/ui/button';
import { clientStatusFromIntent, type ClientPaymentStatus } from '@/features/public-booking/checkout-outcome';

export type StripeIntentMode = 'payment' | 'setup';

/** What Stripe.js says of a refusal besides its words: the kind and the code of the error, never the intent it carries (that one holds the client secret). */
export interface PaymentRefusal {
  type?: string;
  code?: string;
}

interface StripeIntentFormProps {
  mode: StripeIntentMode;
  returnUrl: string;
  /** The intent was submitted without a redirect: its status as far as Stripe.js knows (never the booking's). */
  onSubmitted: (status: ClientPaymentStatus) => void;
  onError: (message: string) => void;
  onRefusal?: (refusal: PaymentRefusal) => void;
  submitLabel?: string;
  busyLabel?: string;
  onProcessingChange?: (processing: boolean) => void;
}

function StripeIntentForm({ mode, returnUrl, onSubmitted, onError, onRefusal, submitLabel, busyLabel: busyText, onProcessingChange }: StripeIntentFormProps) {
  const { t } = useTranslation();
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const confirming = useRef(false);

  const submit = async () => {
    if (!stripe || !elements || confirming.current) return;

    confirming.current = true;
    setProcessing(true);
    onProcessingChange?.(true);
    try {
      if (mode === 'payment') {
        const { error, paymentIntent } = await stripe.confirmPayment({
          elements,
          confirmParams: { return_url: returnUrl },
          redirect: 'if_required',
        });
        if (error) {
          onError(error.message ?? t('publicBooking.paymentFailed'));
          onRefusal?.({ type: error.type, code: error.code });
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
          onRefusal?.({ type: error.type, code: error.code });
          return;
        }
        onSubmitted(clientStatusFromIntent(setupIntent?.status) ?? 'processing');
      }
    } finally {
      confirming.current = false;
      setProcessing(false);
      onProcessingChange?.(false);
    }
  };

  const idleLabel = submitLabel ?? (mode === 'payment' ? t('publicBooking.payNow') : t('publicBooking.confirmPaymentSetup'));
  const busyLabel = busyText ?? (mode === 'payment' ? t('publicBooking.processing') : t('publicBooking.confirming'));

  return (
    <div className="space-y-4" data-testid={mode === 'payment' ? 'checkout-payment-step' : 'checkout-setup-step'}>
      <PaymentElement />
      <Button type="button" className="w-full" onClick={() => void submit()} disabled={processing || !stripe || !elements}>
        {processing ? busyLabel : idleLabel}
      </Button>
    </div>
  );
}

interface StripeIntentPaymentProps extends StripeIntentFormProps {
  publishableKey: string;
  stripeAccountId?: string | null;
  clientSecret: string;
  appearance?: Appearance;
  locale?: StripeElementLocale;
}

export function StripeIntentPayment({
  publishableKey,
  stripeAccountId,
  clientSecret,
  appearance,
  locale,
  ...formProps
}: StripeIntentPaymentProps) {
  const stripePromise = useMemo(
    () => loadStripe(publishableKey, stripeAccountId ? { stripeAccount: stripeAccountId } : undefined),
    [publishableKey, stripeAccountId],
  );

  return (
    <Elements stripe={stripePromise} options={{ clientSecret, appearance, locale }}>
      <StripeIntentForm {...formProps} />
    </Elements>
  );
}
