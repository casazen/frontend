import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Appearance } from '@stripe/stripe-js';
import { CircleAlert, Clock, Lock, ShieldCheck, Undo2 } from 'lucide-react';
import type { PublicBookingCardBlock } from '@/api/public-supplier-booking.api';
import { StripeIntentPayment } from '@/features/public-booking/components/stripe-intent-payment';
import type { ClientPaymentStatus } from '@/features/public-booking/checkout-outcome';
import { formatMoney } from '@/features/supplier/services/lib/service-money';
import { stripeLocale } from '@/lib/stripe-appearance';
import { formatRomeDateTime } from '@/lib/stay-dates';
import { supplierSitePaths } from '@/lib/supplier-site/site-paths';

/**
 * How the Payment Element looks on the site of a supplier: the color of its buttons. The element lives in an iframe of Stripe and cannot
 * read our CSS variables, so the values are passed here; the fonts of the site are not reachable from the iframe either.
 */
function stripeAppearanceFor(buttonColor: string): Appearance {
  return {
    theme: 'stripe',
    variables: {
      colorPrimary: buttonColor,
      colorBackground: '#ffffff',
      colorText: '#1b1f24',
      colorDanger: '#b4232a',
      fontFamily: 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
      borderRadius: '10px',
      spacingUnit: '4px',
    },
  };
}

interface PaymentStepProps {
  slug: string;
  supplierName: string;
  /** What the server gave for the card: the secret to ask the card with, and the amount that is blocked. */
  block: PublicBookingCardBlock & { clientSecret: string; publishableKey: string };
  /** When the hold lapses (UTC): the block has to be confirmed before. */
  expiresAt: string;
  /** The color of the buttons of the site. */
  buttonColor: string;
  /** The card is blocked (Stripe says so; the request is born when the e-mail is checked too, the server decides). */
  onAuthorized: () => void;
}

/**
 * Step 5, "Pagamento": the Payment Element for the block of the card. What it says is exactly what the money does (decisions VT-D1, D24):
 * the amount is only **blocked**; it is charged only if the professional accepts; if it refuses, does not answer or the customer cancels
 * first, the block is released and nothing is charged; CasaZen holds the amount until the customer says all is fine or the time to
 * report a problem ends. No date of accounting is promised and no fee is named.
 */
export function PaymentStep({ slug, supplierName, block, expiresAt, buttonColor, onAuthorized }: PaymentStepProps) {
  const { t, i18n } = useTranslation();
  const [error, setError] = useState<string | null>(null);
  const until = formatRomeDateTime(expiresAt, i18n.language, { hour: '2-digit', minute: '2-digit' });
  const amount = formatMoney(block.amountCents, i18n.language);

  return (
    <div className="vb-step-payment" data-testid="supplier-booking-payment">
      <ul className="vb-pay">
        <li>
          <Lock aria-hidden="true" />
          <span>{t('supplierSite.booking.payment.blocked', { amount })}</span>
        </li>
        <li>
          <Undo2 aria-hidden="true" />
          <span>{t('supplierSite.booking.payment.chargeIfAccepted', { name: supplierName })}</span>
        </li>
        <li>
          <ShieldCheck aria-hidden="true" />
          <span>{t('supplierSite.booking.payment.held')}</span>
        </li>
        {until ? (
          <li>
            <Clock aria-hidden="true" />
            <span>{t('supplierSite.booking.payment.until', { time: until })}</span>
          </li>
        ) : null}
      </ul>

      {error ? (
        <p className="vb-error" role="alert">
          <CircleAlert aria-hidden="true" />
          <span>{error}</span>
        </p>
      ) : null}

      <StripeIntentPayment
        mode="payment"
        publishableKey={block.publishableKey}
        clientSecret={block.clientSecret}
        // A card with 3-D Secure normally stays in the page; if the bank sends the person away, it comes back here and the page says what it can.
        returnUrl={`${window.location.origin}${supplierSitePaths.booking(slug)}?paid=1`}
        appearance={stripeAppearanceFor(buttonColor)}
        locale={stripeLocale(i18n.language)}
        submitLabel={t('supplierSite.booking.payment.submit', { amount })}
        busyLabel={t('supplierSite.booking.payment.working')}
        onError={setError}
        onSubmitted={(status: ClientPaymentStatus) => {
          if (status === 'failed') setError(t('supplierSite.booking.payment.failed'));
          else {
            setError(null);
            onAuthorized();
          }
        }}
      />
    </div>
  );
}
