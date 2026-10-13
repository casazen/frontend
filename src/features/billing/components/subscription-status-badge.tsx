import { useTranslation } from 'react-i18next';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import type { BillingSubscriptionStatus } from '@/types';

const STATUS_VARIANT: Record<BillingSubscriptionStatus, BadgeProps['variant']> = {
  active: 'success',
  trialing: 'default',
  past_due: 'warning',
  incomplete: 'warning',
  unpaid: 'destructive',
  canceled: 'secondary',
  none: 'outline',
};

const STATUS_LABEL_KEY: Record<BillingSubscriptionStatus, string> = {
  active: 'billing.status.active',
  trialing: 'billing.status.trialing',
  past_due: 'billing.status.pastDue',
  incomplete: 'billing.status.incomplete',
  unpaid: 'billing.status.unpaid',
  canceled: 'billing.status.canceled',
  none: 'billing.status.none',
};

/** Subscription state badge (spec-saas-billing AC13). */
export function SubscriptionStatusBadge({ status }: { status: BillingSubscriptionStatus }) {
  const { t } = useTranslation();
  return (
    <Badge variant={STATUS_VARIANT[status]} data-testid="subscription-status-badge">
      {t(STATUS_LABEL_KEY[status])}
    </Badge>
  );
}
