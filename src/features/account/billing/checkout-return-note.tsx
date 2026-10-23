import type { ReactNode } from 'react';
import { CheckCircle2, Info, Loader2, type LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { isPaidStatus, type CheckoutReturn } from '@/features/billing/billing-utils';
import { getPlanTierLabel } from '@/lib/i18n-labels';
import { cn } from '@/lib/utils';
import type { BillingSubscription } from '@/types';
import { isCheckoutSettled } from './use-account-subscription';

interface NoteProps {
  icon: LucideIcon;
  spin?: boolean;
  testId: string;
  action?: ReactNode;
  children: ReactNode;
}

function Note({ icon: Icon, spin = false, testId, action, children }: NoteProps) {
  return (
    <div role="status" data-testid={testId} className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
      <p className="flex min-w-0 items-start gap-2">
        <Icon aria-hidden="true" className={cn('mt-0.5 size-4 shrink-0', spin && 'animate-spin motion-reduce:animate-none')} />
        <span className="min-w-0 break-words">{children}</span>
      </p>
      {action}
    </div>
  );
}

interface CheckoutReturnNoteProps {
  checkoutReturn: CheckoutReturn | null;
  subscription: BillingSubscription | undefined;
  /** A minute has passed since the return and the payment is still not confirmed. */
  timedOut: boolean;
  onRefresh: () => void;
}

/**
 * What the person is told when Stripe sends them back: nothing was charged (cancel), the plan is active, the payment is being
 * checked, or the confirmation is late (with a button to read it again). A payment that did not go through is not here: the plan
 * block says so. Plain lines, not colored boxes: the page has one highlighted block, and it is not this.
 */
export function CheckoutReturnNote({ checkoutReturn, subscription, timedOut, onRefresh }: CheckoutReturnNoteProps) {
  const { t } = useTranslation();

  if (checkoutReturn === 'cancel') {
    return (
      <Note icon={Info} testId="checkout-return-canceled">
        {t('billing.checkout.return.canceled')}
      </Note>
    );
  }
  if (checkoutReturn !== 'success' || !subscription) return null;

  if (isPaidStatus(subscription.status)) {
    return (
      <Note icon={CheckCircle2} testId="checkout-return-confirmed">
        {t('billing.checkout.return.confirmed', { plan: getPlanTierLabel(subscription.planTier, t) })}
      </Note>
    );
  }
  if (isCheckoutSettled(subscription)) return null;

  if (!timedOut) {
    return (
      <Note icon={Loader2} spin testId="checkout-return-confirming">
        {t('billing.checkout.return.confirming')}
      </Note>
    );
  }
  return (
    <Note
      icon={Info}
      testId="checkout-return-pending"
      action={
        <Button type="button" size="sm" variant="outline" onClick={onRefresh}>
          {t('billing.checkout.return.refresh')}
        </Button>
      }
    >
      {t('billing.checkout.return.pending')}
    </Note>
  );
}
