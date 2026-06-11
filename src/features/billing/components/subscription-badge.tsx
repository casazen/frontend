import { Badge } from '@/components/ui/badge';
import type { SubscriptionStatus } from '@/types/billing.types';

const STATUS_LABEL: Record<SubscriptionStatus, string> = {
  active: 'Attivo',
  past_due: 'In ritardo',
  canceled: 'Scaduto',
  trialing: 'Prova',
  none: 'Nessun abbonamento',
};

const STATUS_VARIANT: Record<
  SubscriptionStatus,
  'default' | 'secondary' | 'outline' | 'destructive'
> = {
  active: 'default',
  past_due: 'destructive',
  canceled: 'secondary',
  trialing: 'outline',
  none: 'secondary',
};

interface SubscriptionBadgeProps {
  status: SubscriptionStatus;
}

export function SubscriptionBadge({ status }: SubscriptionBadgeProps) {
  return (
    <Badge variant={STATUS_VARIANT[status]} data-testid="subscription-status-badge">
      {STATUS_LABEL[status]}
    </Badge>
  );
}
