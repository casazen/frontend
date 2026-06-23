import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { PlanCatalogEntry, PlanTier } from '@/types';
import { cn } from '@/lib/utils';

interface PlanCardProps {
  plan: PlanCatalogEntry;
  selectedTier: PlanTier | null;
  currentTier?: PlanTier | null;
  onSelect: (tier: PlanTier) => void;
  isLoading?: boolean;
  actionLabel?: string;
}

export function PlanCard({
  plan,
  selectedTier,
  currentTier,
  onSelect,
  isLoading = false,
  actionLabel,
}: PlanCardProps) {
  const { t } = useTranslation();
  const isSelected = selectedTier === plan.tier;
  const isCurrent = currentTier === plan.tier;

  function formatLimit(maxProperties: number): string {
    if (maxProperties < 0) return t('plan.unlimitedProperties');
    if (maxProperties === 1) return t('plan.oneProperty');
    return t('plan.upToProperties', { count: maxProperties });
  }

  return (
    <Card
      data-testid={`plan-card-${plan.tier}`}
      className={cn(
        'transition-shadow hover:shadow-md',
        isSelected && 'ring-2 ring-primary',
        isCurrent && 'border-primary/40',
      )}
    >
      <CardHeader>
        <CardTitle>{plan.displayName}</CardTitle>
        <CardDescription>{plan.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{formatLimit(plan.maxProperties)}</p>
        <Button
          type="button"
          className="w-full"
          variant={isCurrent ? 'secondary' : 'default'}
          disabled={isLoading || isCurrent}
          onClick={() => onSelect(plan.tier)}
        >
          {isCurrent
            ? t('plan.currentPlan')
            : isLoading && isSelected
              ? t('plan.saving')
              : actionLabel ?? t('plan.choosePlan')}
        </Button>
      </CardContent>
    </Card>
  );
}
