import { AlertTriangle, CheckCircle2, Circle, Clock, type LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { MarketplaceCardStatus } from '@/types';

/** What a badge can say: the status of a card, or `Requested` (the Active tab: a function that waits for the license). */
type BadgeStatus = MarketplaceCardStatus | 'Requested';

/** Colour and icon of each status (UX-09): the colour is never the only sign, the word and the icon say it too. */
const STATUS_LOOK: Record<BadgeStatus, { variant: NonNullable<BadgeProps['variant']>; Icon: LucideIcon }> = {
  Active: { variant: 'success', Icon: CheckCircle2 },
  Pending: { variant: 'warning', Icon: Clock },
  Requested: { variant: 'warning', Icon: Clock },
  ToFix: { variant: 'destructive', Icon: AlertTriangle },
  NotActive: { variant: 'outline', Icon: Circle },
};

interface MarketplaceStatusBadgeProps {
  status: BadgeStatus;
  /**
   * Only the host's word backs the status (`isDeclared`): an active integration is then not drawn in the green of a proven one, so that the colour says no more than the data
   * does. The word stays the one of the status; the card says «declared by you» next to it.
   */
  declared?: boolean;
  className?: string;
  'data-testid'?: string;
}

/** Where an integration stands: Active, Not active, Pending, Requested or To fix. A status this page does not know draws nothing. */
export function MarketplaceStatusBadge({ status, declared = false, className, 'data-testid': testId }: MarketplaceStatusBadgeProps) {
  const { t } = useTranslation();
  const look = STATUS_LOOK[status] as (typeof STATUS_LOOK)[BadgeStatus] | undefined;
  if (!look) return null;

  return (
    <Badge variant={declared && status === 'Active' ? 'outline' : look.variant} className={cn('gap-1', className)} data-testid={testId}>
      <look.Icon aria-hidden="true" className="size-3 shrink-0" />
      {t(`marketplace.status.${status}`)}
    </Badge>
  );
}
