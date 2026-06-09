import { usePlans } from '@/queries/use-users';
import type { PlanTier } from '@/types';
import { PlanCard } from '@/components/org/plan-card';
import { Skeleton } from '@/components/ui/skeleton';

interface PlanSelectionGridProps {
  selectedTier: PlanTier | null;
  currentTier?: PlanTier | null;
  onSelect: (tier: PlanTier) => void;
  isLoading?: boolean;
  actionLabel?: string;
}

export function PlanSelectionGrid({
  selectedTier,
  currentTier,
  onSelect,
  isLoading = false,
  actionLabel,
}: PlanSelectionGridProps) {
  const { data: plans, isLoading: plansLoading } = usePlans();

  if (plansLoading) {
    return (
      <div className="grid gap-6 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-48 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-6 text-left md:grid-cols-3" data-testid="plan-selection-grid">
      {(plans ?? []).map((plan) => (
        <PlanCard
          key={plan.tier}
          plan={plan}
          selectedTier={selectedTier}
          currentTier={currentTier}
          onSelect={onSelect}
          isLoading={isLoading}
          actionLabel={actionLabel}
        />
      ))}
    </div>
  );
}
