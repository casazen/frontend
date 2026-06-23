import { Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { PlanSelectionGrid } from '@/components/org/plan-selection-grid';
import { useCurrentUser, useEntitlement, usePlans, useUpdateMyPlan } from '@/queries/use-users';
import { needsOrgSetup } from '@/lib/onboarding';
import type { PlanTier } from '@/types';
import { useState } from 'react';

export function PlanSettingsPage() {
  const { t } = useTranslation();
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
          title={t('settings.planTitle')}
          description={
            org
              ? t('settings.planOrgDescription', { orgName: org.name })
              : t('settings.planDefaultDescription')
          }
        />

        {entitlement && (
          <div
            className="rounded-md border bg-muted/40 px-4 py-3 text-sm"
            data-testid="plan-usage-summary"
          >
            <p>
              {t('settings.currentUsage')} <strong>{entitlement.usage.properties}</strong>{' '}
              {t('settings.planUsage', {
                propertyCount: entitlement.usage.properties,
                maxProperties: entitlement.limits.maxProperties >= 1_000_000
                  ? t('settings.unlimited')
                  : entitlement.limits.maxProperties,
              })}.
            </p>
          </div>
        )}

        <PlanSelectionGrid
          selectedTier={selectedTier ?? planTier}
          currentTier={planTier}
          onSelect={(tier) => void handleSelect(tier)}
          isLoading={updatePlan.isPending}
          actionLabel={t('settings.switchToPlan')}
        />

        <p className="text-sm text-muted-foreground">
          {t('settings.stripeBillingNote', { planCount: plans?.length ?? 3 })}
        </p>
      </div>
    </AppShell>
  );
}
