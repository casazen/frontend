import { useTranslation } from 'react-i18next';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { getPlanTierLabel } from '@/lib/i18n-labels';
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
  const { t } = useTranslation();

  return (
    <Badge
      variant={TIER_VARIANT[planTier] ?? 'secondary'}
      className={className}
      data-testid="plan-badge"
    >
      {getPlanTierLabel(planTier, t)}
    </Badge>
  );
}
