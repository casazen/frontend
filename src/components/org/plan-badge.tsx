import { Badge, type BadgeProps } from '@/components/ui/badge';
import type { PlanTier } from '@/types';

const TIER_VARIANT: Record<PlanTier, BadgeProps['variant']> = {
  Starter: 'secondary',
  Pro: 'default',
  Scale: 'success',
};

interface PlanBadgeProps {
  planTier: PlanTier;
  className?: string;
}

/** Read-only plan indicator (#202, AC11). */
export function PlanBadge({ planTier, className }: PlanBadgeProps) {
  return (
    <Badge
      variant={TIER_VARIANT[planTier] ?? 'secondary'}
      className={className}
      data-testid="plan-badge"
    >
      {planTier}
    </Badge>
  );
}
