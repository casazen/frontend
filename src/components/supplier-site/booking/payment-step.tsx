import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CircleAlert, Clock, Lock, ShieldCheck, Undo2 } from 'lucide-react';
import type { PublicBookingCardBlock } from '@/api/public-supplier-booking.api';
import { StripeIntentPayment } from '@/features/public-booking/components/stripe-intent-payment';
import type { ClientPaymentStatus } from '@/features/public-booking/checkout-outcome';
import { formatMoney } from '@/features/supplier/services/lib/service-money';
import { stripeLocale } from '@/lib/stripe-appearance';
import { stripeAppearanceFor } from '@/lib/supplier-site/payment-appearance';
import { formatRomeDateTime } from '@/lib/stay-dates';
import { supplierSitePaths } from '@/lib/supplier-site/site-paths';

interface PaymentStepProps {
  slug: string;
  supplierName: string;
  block: PublicBookingCardBlock & { clientSecret: string; publishableKey: string };
  expiresAt: string;
  buttonColor: string;
  onAuthorized: () => void;
}

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
