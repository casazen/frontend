import { AlertTriangle, CheckCircle2, Circle, Clock, type LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { MarketplaceCardStatus } from '@/types';

/** Colour and icon of each status (UX-09): the colour is never the only sign, the word and the icon say it too. */
const STATUS_LOOK: Record<MarketplaceCardStatus, { variant: NonNullable<BadgeProps['variant']>; Icon: LucideIcon }> = {
  Active: { variant: 'success', Icon: CheckCircle2 },
  Pending: { variant: 'warning', Icon: Clock },
  ToFix: { variant: 'destructive', Icon: AlertTriangle },
  NotActive: { variant: 'outline', Icon: Circle },
};

interface MarketplaceStatusBadgeProps {
  status: MarketplaceCardStatus;
  className?: string;
  'data-testid'?: string;
}

/** Where an integration stands: Active, Not active, Pending or To fix. A status this page does not know draws nothing. */
export function MarketplaceStatusBadge({ status, className, 'data-testid': testId }: MarketplaceStatusBadgeProps) {
  const { t } = useTranslation();
  const look = STATUS_LOOK[status] as (typeof STATUS_LOOK)[MarketplaceCardStatus] | undefined;
  if (!look) return null;

  return (
    <Badge variant={look.variant} className={cn('gap-1', className)} data-testid={testId}>
      <look.Icon aria-hidden="true" className="size-3 shrink-0" />
      {t(`marketplace.status.${status}`)}
    </Badge>
  );
}
