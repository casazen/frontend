import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { ClientPaymentStatus } from '@/features/public-booking/checkout-outcome';
import { StripeIntentPayment } from '@/features/public-booking/components/stripe-intent-payment';
import { formatMoney } from '@/features/supplier/services/lib/service-money';
import type { ServicePaymentSession } from '@/types/service-request';

interface PayInterventionDialogProps {
  /** What Stripe.js needs to pay (`POST …/payment-session`): a credential, used here and never kept. */
  session: ServicePaymentSession;
  /** The supplier, in the words of the dialog: who is paid. */
  supplierName?: string | null;
  /** Where Stripe leads the host back to when its bank asks for a step outside the window: the page of the request. */
  returnUrl: string;
  onClose: () => void;
  /** The card was sent to Stripe (the result as far as the browser knows it, never the state of the request: the backend says that). */
  onSubmitted: (status: ClientPaymentStatus) => void;
}

/**
 * «Paga» for a request paid inside CasaZen (SR-08, only with `SupplierOnlinePayments`, which is off by default): the Stripe Payment Element in
 * a window, on the account the API names (`stripeAccountId`: today the supplier's connected account, not presumed here, so that the model
 * with funds held by CasaZen only changes the session). The amount and who is paid are said in the window. The request is marked paid
 * only when the backend says so, after Stripe confirms to it.
 */
export function PayInterventionDialog({ session, supplierName, returnUrl, onClose, onSubmitted }: PayInterventionDialogProps) {
  const { t, i18n } = useTranslation();
  const [error, setError] = useState<string | null>(null);
  const amount = formatMoney(session.amountCents, i18n.language);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto" data-testid="intervention-pay-dialog">
        <DialogHeader>
          <DialogTitle>{t('interventions.pay.title')}</DialogTitle>
          <DialogDescription>
            {supplierName?.trim()
              ? t('interventions.pay.description', { amount, supplier: supplierName.trim() })
              : t('interventions.pay.descriptionNoSupplier', { amount })}
          </DialogDescription>
        </DialogHeader>

        {error ? (
          <p role="alert" className="text-sm text-destructive" data-testid="intervention-pay-error">
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
            // A card that was refused stays in the window, with the words: the host can try another.
            if (status === 'failed') {
              setError(t('interventions.pay.failed'));
              return;
            }
            setError(null);
            onSubmitted(status);
          }}
          onError={setError}
        />
        <p className="text-sm text-foreground/70">{t('interventions.pay.notice')}</p>
      </DialogContent>
    </Dialog>
  );
}
