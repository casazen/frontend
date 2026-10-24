import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { ClientPaymentStatus } from '@/features/public-booking/checkout-outcome';
import { StripeIntentPayment } from '@/features/public-booking/components/stripe-intent-payment';
import { formatMoney } from '@/features/supplier/services/lib/service-money';
import type { ServicePaymentSession } from '@/types/service-request';

interface PayLongRentRequestDialogProps {
  /** What Stripe.js needs to pay (`POST …/payment-session`): a credential, used here and never kept. */
  session: ServicePaymentSession;
  /** Where Stripe leads the landlord back to when its bank asks for a step outside the window: the page of the request. */
  returnUrl: string;
  onClose: () => void;
  /** The card was sent to Stripe (the result as far as the browser knows it, never the state of the request: the backend says that). */
  onSubmitted: (status: ClientPaymentStatus) => void;
}

/**
 * «Paga» for a request paid inside CasaZen (LR-08b): the Stripe Payment Element in a window, on the supplier's connected account
 * (the same element as the payments of the guests and of the tenants). The request is marked paid only when the backend says so,
 * after Stripe confirms to it; the page reads it again until then.
 */
export function PayLongRentRequestDialog({ session, returnUrl, onClose, onSubmitted }: PayLongRentRequestDialogProps) {
  const { t, i18n } = useTranslation();
  const [error, setError] = useState<string | null>(null);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto" data-testid="long-rent-request-pay-dialog">
        <DialogHeader>
          <DialogTitle>{t('longRentRequests.pay.title')}</DialogTitle>
          <DialogDescription>{t('longRentRequests.pay.description', { amount: formatMoney(session.amountCents, i18n.language) })}</DialogDescription>
        </DialogHeader>

        {error ? (
          <p role="alert" className="text-sm text-destructive" data-testid="long-rent-request-pay-error">
            {error}
          </p>
        ) : null}

        <StripeIntentPayment
          mode="payment"
          publishableKey={session.publishableKey}
          stripeAccountId={session.stripeAccountId}
          clientSecret={session.clientSecret}
          returnUrl={returnUrl}
          onSubmitted={(status) => {
            // A card that was refused stays in the window, with the words: the landlord can try another.
            if (status === 'failed') {
              setError(t('longRentRequests.pay.failed'));
              return;
            }
            setError(null);
            onSubmitted(status);
          }}
          onError={setError}
        />
        <p className="text-sm text-foreground/70">{t('longRentRequests.pay.notice')}</p>
      </DialogContent>
    </Dialog>
  );
}
