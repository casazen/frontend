import { Navigate } from 'react-router-dom';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { PlanSelectionGrid } from '@/components/org/plan-selection-grid';
import { useCurrentUser, useEntitlement, usePlans, useUpdateMyPlan } from '@/queries/use-users';
import { needsOrgSetup } from '@/lib/onboarding';
import type { PlanTier } from '@/types';
import { useState } from 'react';

export function PlanSettingsPage() {
  const { org, planTier, user } = useCurrentUser();
  const { data: entitlement } = useEntitlement();
  const { data: plans } = usePlans();
  const updatePlan = useUpdateMyPlan();
  const [selectedTier, setSelectedTier] = useState<PlanTier | null>(null);

  const handleSelect = async (tier: PlanTier) => {
    setSelectedTier(tier);
    await updatePlan.mutateAsync(tier);
    setSelectedTier(null);
  };

  if (user && needsOrgSetup(user)) {
    return <Navigate to="/onboarding" replace />;
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl space-y-6">
        <PageHeader
          title="Il tuo piano"
          description={
            org
              ? `Organizzazione: ${org.name}. Scegli il piano più adatto al tuo portfolio.`
              : 'Gestisci il piano della tua organizzazione.'
          }
        />

        {entitlement && (
          <div
            className="rounded-md border bg-muted/40 px-4 py-3 text-sm"
            data-testid="plan-usage-summary"
          >
            <p>
              Utilizzo attuale: <strong>{entitlement.usage.properties}</strong> proprietà su{' '}
              <strong>
                {entitlement.limits.maxProperties >= 1_000_000
                  ? 'illimitate'
                  : entitlement.limits.maxProperties}
              </strong>
              .
            </p>
          </div>
        )}

        <PlanSelectionGrid
          selectedTier={selectedTier ?? planTier}
          currentTier={planTier}
          onSelect={(tier) => void handleSelect(tier)}
          isLoading={updatePlan.isPending}
          actionLabel="Passa a questo piano"
        />

        <p className="text-sm text-muted-foreground">
          Il pagamento ricorrente con carta sarà disponibile con l&apos;integrazione Stripe (
          {plans?.length ?? 3} piani configurati).
        </p>
      </div>
    </AppShell>
  );
}
