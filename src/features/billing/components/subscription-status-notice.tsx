import { AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { BillingSubscriptionStatus } from '@/types';

type PaymentStatus = Extract<BillingSubscriptionStatus, 'past_due' | 'incomplete' | 'unpaid'>;

const NOTICE_KEY: Record<PaymentStatus, string> = {
  past_due: 'billing.notice.pastDue',
  incomplete: 'billing.notice.incomplete',
  unpaid: 'billing.notice.unpaid',
};

interface SubscriptionPaymentNoticeProps {
  status: BillingSubscriptionStatus;
  onOpenPortal: () => void;
  portalPending: boolean;
}

/**
 * What to do when a payment is due (PL-10): past due within the grace period, first payment not completed
 * (`incomplete`), subscription suspended (`unpaid`). The payment is completed in the Stripe billing portal.
 * Renders nothing for the other states.
 */
export function SubscriptionPaymentNotice({ status, onOpenPortal, portalPending }: SubscriptionPaymentNoticeProps) {
  const { t } = useTranslation();
  if (status !== 'past_due' && status !== 'incomplete' && status !== 'unpaid') return null;

  return (
    <div
      role="alert"
      data-testid={`subscription-notice-${status}`}
      className={cn(
        'flex flex-col gap-3 rounded-md border px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between',
        status === 'unpaid'
          ? 'border-destructive/50 bg-destructive/10'
          : 'border-amber-500/50 bg-amber-500/10',
      )}
    >
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <p>{t(NOTICE_KEY[status])}</p>
      </div>
      <Button type="button" size="sm" onClick={onOpenPortal} disabled={portalPending}>
        {portalPending ? t('billing.portal.opening') : t('billing.portal.completePayment')}
      </Button>
    </div>
  );
}
