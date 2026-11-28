import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CircleAlert, Lock, ShieldCheck, Undo2 } from 'lucide-react';
import { publicBookingApi, type PublicBookingOffer, type PublicBookingPaymentSession, type PublicBookingView } from '@/api/public-supplier-booking.api';
import { StripeIntentPayment } from '@/features/public-booking/components/stripe-intent-payment';
import type { ClientPaymentStatus } from '@/features/public-booking/checkout-outcome';
import { formatMoney } from '@/features/supplier/services/lib/service-money';
import { stripeLocale } from '@/lib/stripe-appearance';
import { stripeAppearanceFor } from '@/lib/supplier-site/payment-appearance';
import type { RequestFailure } from '@/lib/supplier-site/request-errors';
import { supplierSitePaths } from '@/lib/supplier-site/site-paths';
import type { QuietCall } from './types';
import { useViewPolling } from './use-view-polling';

const TAKE_POLL_MS = 4_000;

interface OfferPaymentProps {
  view: PublicBookingView;
  offer: PublicBookingOffer;
  buttonColor: string;
  quiet: QuietCall;
  onFailure: (failure: RequestFailure) => void;
  onContinue: () => void;
  busy: boolean;
}

/**
 * The card of an accepted offer paid inside CasaZen (SP-10b-b, SP-12c). What it says is exactly what the money does: the amount is
 * **blocked**; if the time of the offer is still free it is charged and the request is taken; if it is not, the block is removed and
 * nothing is charged; CasaZen holds the amount until the customer says all is fine or the time to report a problem ends. No date of
 * accounting is promised and no fee is named. Once the card is through the request is taken by the server (when Stripe says so, and when
 * the page asks again, which covers a late message), so the page asks every few seconds until it is.
 */
export function OfferPayment({ view, offer, buttonColor, quiet, onFailure, onContinue, busy }: OfferPaymentProps) {
  const { t, i18n } = useTranslation();
  const titleId = useId();
  const session: PublicBookingPaymentSession | null = view.paymentSession ?? null;
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const amount = formatMoney(session?.amountCents ?? offer.totalCents, i18n.language);
  const name = view.supplier.name;

  useViewPolling({
    enabled: confirmed,
    baseMs: TAKE_POLL_MS,
    maxMs: TAKE_POLL_MS,
    tick: async () => {
      const outcome = await quiet((access) => publicBookingApi.acceptOffer(access, offer.sentAt));
      if (outcome.ok) return 'asked';
      setConfirmed(false);
      onFailure(outcome.failure);
      return null;
    },
  });

  return (
    <section className="vz-section vz-section--tight vi-pay" aria-labelledby={titleId} data-testid="supplier-inquiry-payment">
      <div className="vz-container">
        <div className="vi-pay__in">
          <h2 id={titleId} className="vf-h2">
            {t('supplierSite.inquiry.payment.title')}
          </h2>
          <ul className="vb-pay">
            <li>
              <Lock aria-hidden="true" />
              <span>{t('supplierSite.booking.payment.blocked', { amount })}</span>
            </li>
            <li>
              <Undo2 aria-hidden="true" />
              <span>{t('supplierSite.inquiry.payment.chargeIfFree', { name })}</span>
            </li>
            <li>
              <ShieldCheck aria-hidden="true" />
              <span>{t('supplierSite.booking.payment.held')}</span>
            </li>
          </ul>

          {error ? (
            <p className="vb-error" role="alert">
              <CircleAlert aria-hidden="true" />
              <span>{error}</span>
            </p>
          ) : null}

          {confirmed ? (
            <p className="vb-note" role="status" data-testid="supplier-inquiry-payment-confirmed">
              {t('supplierSite.inquiry.payment.taking', { name })}
            </p>
          ) : session ? (
            <StripeIntentPayment
              mode="payment"
              publishableKey={session.publishableKey}
              clientSecret={session.clientSecret}
              returnUrl={`${window.location.origin}${supplierSitePaths.request(view.supplier.slug)}?code=${encodeURIComponent(view.publicCode)}`}
              appearance={stripeAppearanceFor(buttonColor)}
              locale={stripeLocale(i18n.language)}
              submitLabel={t('supplierSite.booking.payment.submit', { amount })}
              busyLabel={t('supplierSite.booking.payment.working')}
              onError={setError}
              onSubmitted={(status: ClientPaymentStatus) => {
                if (status === 'failed') {
                  setError(t('supplierSite.booking.payment.failed'));
                  return;
                }
                setError(null);
                setConfirmed(true);
              }}
            />
          ) : (
            <div className="vf-panel__a">
              <button type="button" className="vz-btn vz-btn--primary vz-btn--lg" disabled={busy} onClick={onContinue}>
                {busy ? t('supplierSite.request.working') : t('supplierSite.inquiry.payment.continue')}
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
