import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { PlanDto } from '@/types/billing.types';
import type { PlanTier } from '@/types';
import { cn } from '@/lib/utils';

function formatPrice(priceMonthly: number, currency: string): string {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(priceMonthly);
}

function formatAllowance(unitAllowance: number): string {
  if (unitAllowance < 0) return 'Proprietà illimitate';
  return unitAllowance === 1 ? '1 proprietà' : `Fino a ${unitAllowance} proprietà`;
}

interface BillingPlanCardProps {
  plan: PlanDto;
  currentTier?: PlanTier | null;
  onChoose: (tier: PlanTier) => void;
  isLoading?: boolean;
  loadingTier?: PlanTier | null;
}

export function BillingPlanCard({
  plan,
  currentTier,
  onChoose,
  isLoading = false,
  loadingTier,
}: BillingPlanCardProps) {
  const isCurrent = currentTier === plan.tier;
  const isChoosing = isLoading && loadingTier === plan.tier;

  return (
    <Card
      data-testid={`billing-plan-card-${plan.tier}`}
      className={cn(
        'transition-shadow hover:shadow-md',
        isCurrent && 'border-primary/40 ring-1 ring-primary/30',
      )}
    >
      <CardHeader>
        <CardTitle>{plan.displayName}</CardTitle>
        <CardDescription>
          {formatPrice(plan.priceMonthly, plan.currency)} / mese
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{formatAllowance(plan.unitAllowance)}</p>
        <ul className="space-y-1 text-sm text-muted-foreground">
          {plan.features.map((feature) => (
            <li key={feature}>• {feature}</li>
          ))}
        </ul>
        <Button
          type="button"
          className="w-full"
          variant={isCurrent ? 'secondary' : 'default'}
          disabled={isCurrent || isLoading}
          onClick={() => onChoose(plan.tier)}
        >
          {isCurrent ? 'Piano attuale' : isChoosing ? 'Avvio...' : 'Scegli piano'}
        </Button>
      </CardContent>
    </Card>
  );
}
