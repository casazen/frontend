import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { getProblemMessage } from '@/lib/api-errors';
import { BILLING_PLANS_QUERY_KEY, useStartCheckout } from '@/queries/use-billing';
import type { BillingPlan, BillingSubscription } from '@/types';
import { toBillingProfileRequest, type BillingProfileValues } from '../billing-profile.schema';
import {
  ALREADY_SUBSCRIBED_CODE,
  BILLING_PLAN_UNAVAILABLE_CODE,
  buildCheckoutReturnUrls,
  getErrorCode,
} from '../billing-utils';
import { BillingProfileForm } from './billing-profile-form';

interface CheckoutDialogProps {
  /** Plan being bought; the dialog is open while it is set. */
  plan: BillingPlan | null;
  /** Saved billing profile, to prefill country and VAT id. */
  subscription: BillingSubscription | undefined;
  onClose: () => void;
  /** 409 `already_subscribed`: the page offers the billing portal instead. */
  onAlreadySubscribed: () => void;
}

/**
 * Last step before Stripe Checkout (spec-saas-billing AC10, AC12): country and optional VAT id of the invoice, then
 * `POST /api/billing/checkout-session` and the redirect to Stripe. The outcome is read back from the backend on the
 * return page, never assumed from the redirect.
 */
export function CheckoutDialog({ plan, subscription, onClose, onAlreadySubscribed }: CheckoutDialogProps) {
  const { t } = useTranslation();
  const location = useLocation();
  const queryClient = useQueryClient();
  const checkout = useStartCheckout();
  const [error, setError] = useState<string | null>(null);
  // After a successful call the browser is leaving for Stripe: the form stays disabled.
  const busy = checkout.isPending || checkout.isSuccess;

  const handleOpenChange = (open: boolean) => {
    if (open || busy) return;
    setError(null);
    checkout.reset();
    onClose();
  };

  const handleSubmit = (values: BillingProfileValues) => {
    if (!plan) return;
    setError(null);
    checkout.mutate(
      { planTier: plan.tier, ...toBillingProfileRequest(values), ...buildCheckoutReturnUrls(location.pathname) },
      {
        onError: (err) => {
          const code = getErrorCode(err);
          if (code === ALREADY_SUBSCRIBED_CODE) {
            checkout.reset();
            onAlreadySubscribed();
            return;
          }
          if (code === BILLING_PLAN_UNAVAILABLE_CODE) {
            void queryClient.invalidateQueries({ queryKey: BILLING_PLANS_QUERY_KEY });
          }
          setError(getProblemMessage(err, t) ?? t('billing.checkout.failed'));
        },
      },
    );
  };

  return (
    <Dialog open={plan !== null} onOpenChange={handleOpenChange}>
      <DialogContent data-testid="checkout-dialog">
        {plan && (
          <>
            <DialogHeader>
              <DialogTitle>{t('billing.checkout.title', { plan: plan.displayName })}</DialogTitle>
              <DialogDescription>{t('billing.checkout.description')}</DialogDescription>
            </DialogHeader>
            <BillingProfileForm
              idPrefix="checkout"
              defaultValues={{
                billingCountry: subscription?.billingCountry ?? '',
                vatId: subscription?.vatId ?? '',
              }}
              submitLabel={t('billing.checkout.submit')}
              pendingLabel={t('billing.checkout.redirecting')}
              isPending={busy}
              onSubmit={handleSubmit}
              secondaryAction={
                <Button type="button" variant="outline" disabled={busy} onClick={() => handleOpenChange(false)}>
                  {t('shared.cancel')}
                </Button>
              }
            >
              {error && (
                <p role="alert" data-testid="checkout-error" className="text-sm text-destructive">
                  {error}
                </p>
              )}
            </BillingProfileForm>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
