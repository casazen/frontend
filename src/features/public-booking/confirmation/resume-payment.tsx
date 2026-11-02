import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CreditCard, WifiOff } from 'lucide-react';
import { useResumeCheckoutPayment } from '@/queries/use-public-booking';
import { getProblemMessage } from '@/lib/api-errors';
import { buildCheckoutOutcomePath } from '@/lib/booking-url';
import { stripeAppearance, stripeLocale } from '@/lib/stripe-appearance';
import { useSiteAppearance } from '@/features/public-site/site-appearance-context';
import { StripeIntentPayment } from '@/features/public-booking/components/stripe-intent-payment';
import type { ClientPaymentStatus } from '@/features/public-booking/checkout-outcome';
import './confirmation.css';

interface ResumePaymentProps {
  orgSlug: string;
  bookingId: string;
  token: string;
  label: string;
  online: boolean;
  onSubmitted: (status: ClientPaymentStatus) => void;
  /** The backend says there is no hold or no payment left: the page reads the booking again. */
  onUnavailable: () => void;
}

/**
 * Pays the same hold again: the client secret of the booking's own intent comes from the backend, which answers 409 once the hold has
 * expired (`checkout_hold_expired`) or there is nothing left to pay. The Payment Element wears the colors and the language of the site,
 * as it did in the checkout. It is the one action of a payment that failed or is still to be done.
 */
export function ResumePayment({ orgSlug, bookingId, token, label, online, onSubmitted, onUnavailable }: ResumePaymentProps) {
  const { t, i18n } = useTranslation();
  const { themeId, colorStyle } = useSiteAppearance();
  const resume = useResumeCheckoutPayment();
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const session = resume.data;
  const clientSecret = session?.clientSecret || session?.setupIntentClientSecret;

  if (session && clientSecret) {
    return (
      <div className="bc-pay" data-testid="checkout-outcome-resume">
        <StripeIntentPayment
          publishableKey={session.connectedAccountPublishableContext.publishableKey}
          stripeAccountId={session.connectedAccountPublishableContext.stripeAccountId}
          clientSecret={clientSecret}
          mode={session.clientSecret ? 'payment' : 'setup'}
          returnUrl={`${window.location.origin}${buildCheckoutOutcomePath(orgSlug, bookingId, token)}`}
          onSubmitted={(status) => {
            setPaymentError(null);
            resume.reset();
            onSubmitted(status);
          }}
          onError={setPaymentError}
          appearance={stripeAppearance(themeId, colorStyle as Record<string, string> | undefined)}
          locale={stripeLocale(i18n.language)}
        />
        {paymentError ? (
          <p className="bc-pay__error" role="alert" data-testid="checkout-outcome-payment-error">
            {paymentError}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="bc-pay">
      {resume.isError ? (
        <p className="bc-pay__error" role="alert" data-testid="checkout-outcome-resume-error">
          {getProblemMessage(resume.error, t) ?? t('publicBooking.outcome.resumeError')}
        </p>
      ) : null}
      <button
        type="button"
        className="public-site-cta bc-cta border-0"
        aria-disabled={!online || resume.isPending ? true : undefined}
        onClick={() => {
          if (!online || resume.isPending) return;
          resume.mutate({ bookingId, token }, { onError: onUnavailable });
        }}
        data-testid="checkout-outcome-resume-button"
      >
        <CreditCard aria-hidden />
        {resume.isPending ? t('publicBooking.preparingPayment') : label}
      </button>
      {!online ? (
        <p className="bc-pay__why">
          <WifiOff aria-hidden />
          <span>{t('siteConfirm.offlineAction')}</span>
        </p>
      ) : null}
    </div>
  );
}
