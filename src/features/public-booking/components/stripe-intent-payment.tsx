import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { loadStripe, type Appearance, type StripeElementLocale } from '@stripe/stripe-js';
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
  /** The words of the button; left out, "Paga subito" / "Conferma" as the checkout has always said. A block that is not a charge says so here. */
  submitLabel?: string;
  busyLabel?: string;
  /** Told when a confirmation starts and when it ends: a page with other buttons beside the form holds them while the money moves (the check-in page, in a step). */
  onProcessingChange?: (processing: boolean) => void;
}

function StripeIntentForm({ mode, returnUrl, onSubmitted, onError, submitLabel, busyLabel: busyText, onProcessingChange }: StripeIntentFormProps) {
  const { t } = useTranslation();
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  // One confirmation at a time: the button is disabled while it runs, and a second click that comes before the page has drawn that is ignored here too (money: never two charges).
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
      {/* `type="button"`: the element sits inside the form of the check-in page, where a button with no type would send the whole check-in. */}
      <Button type="button" className="w-full" onClick={() => void submit()} disabled={processing || !stripe || !elements}>
        {processing ? busyLabel : idleLabel}
      </Button>
    </div>
  );
}

interface StripeIntentPaymentProps extends StripeIntentFormProps {
  publishableKey: string;
  /** Connected account of the host: the checkout makes direct charges. Without one (a charge on the platform) Stripe.js uses the platform's own account. */
  stripeAccountId?: string | null;
  clientSecret: string;
  /** How the element looks: the theme and color of the site (`stripeAppearance`). Left out, Stripe's own look. */
  appearance?: Appearance;
  /** The language of the element (`stripeLocale`). Left out, the one of the browser. */
  locale?: StripeElementLocale;
}

/**
 * Stripe Payment Element for the PaymentIntent ("Paga subito") or the SetupIntent ("Paga alla scadenza") of a booking.
 * Used by the checkout and, to pay the same hold again, by the outcome page.
 */
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
