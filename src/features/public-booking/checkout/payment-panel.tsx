import { useTranslation } from 'react-i18next';
import { Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { isDemoMode } from '@/config/demo.config';
import { useSiteAppearance } from '@/features/public-site/site-appearance-context';
import { StripeIntentPayment } from '@/features/public-booking/components/stripe-intent-payment';
import type { ClientPaymentStatus } from '@/features/public-booking/checkout-outcome';
import { stripeAppearance, stripeLocale } from '@/lib/stripe-appearance';
import type { DirectBookingResponse } from '@/types';
import '@/features/public-booking/checkout/checkout.css';

interface PaymentPanelProps {
  booking: DirectBookingResponse;
  /** Where Stripe sends the guest back after a redirect method: the outcome page of this booking. */
  returnUrl: string;
  error: string | null;
  onError: (message: string) => void;
  onSubmitted: (status: ClientPaymentStatus) => void;
}

/**
 * The last part of the last step (DB-05): the booking exists, its dates are held, and the Payment Element of Stripe takes the card in the
 * colors and the language of the site. The sentence on the hold is here and nowhere before: it is true only once the booking is made (D24).
 * Demo builds have no Stripe: a button confirms the payment, as they always had.
 */
export function PaymentPanel({ booking, returnUrl, error, onError, onSubmitted }: PaymentPanelProps) {
  const { t, i18n } = useTranslation();
  const { themeId, colorStyle } = useSiteAppearance();
  const secret = booking.clientSecret || booking.setupIntentClientSecret || '';

  return (
    <div className="co-pay" data-testid="checkout-payment">
      <p className="co-pay__hold" role="status">
        <Clock aria-hidden />
        <span>{t('publicCheckout.pay.hold')}</span>
      </p>

      {isDemoMode ? (
        <div className="space-y-4" data-testid="checkout-payment-step">
          <p className="text-sm text-[var(--cz-public-muted)]">{t('publicBooking.demoPaymentNote')}</p>
          <Button className="public-site-cta w-full border-0" onClick={() => onSubmitted('succeeded')}>
            {t('publicBooking.payNow')}
          </Button>
        </div>
      ) : secret ? (
        <StripeIntentPayment
          publishableKey={booking.connectedAccountPublishableContext.publishableKey}
          stripeAccountId={booking.connectedAccountPublishableContext.stripeAccountId}
          clientSecret={secret}
          mode={booking.clientSecret ? 'payment' : 'setup'}
          returnUrl={returnUrl}
          onSubmitted={onSubmitted}
          onError={onError}
          appearance={stripeAppearance(themeId, colorStyle as Record<string, string> | undefined)}
          locale={stripeLocale(i18n.language)}
        />
      ) : null}

      {error ? (
        <p className="text-sm text-[var(--cz-public-err)]" role="alert" data-testid="checkout-payment-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}
