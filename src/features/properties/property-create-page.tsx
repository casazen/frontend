import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { PropertyForm } from './components/property-form';
import { useCreateProperty } from '@/queries/use-properties';
import { useEntitlement } from '@/queries/use-users';
import {
  isPlanLimitError,
  getPlanLimitMessage,
  getPlanUpgradeCta,
  PLAN_UPGRADE_PATH,
} from '@/lib/entitlement-error';
import type { PropertyFormValues } from './schemas/property.schema';

export function PropertyCreatePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const createProperty = useCreateProperty();
  const { data: entitlement } = useEntitlement();
  const [planLimitHit, setPlanLimitHit] = useState(false);

  // Block on a proactive entitlement read OR a server 403/409 we just caught.
  // The server stays the source of truth — a stale client cannot bypass the limit (AC8/AC12).
  const blockedByPlan = planLimitHit || entitlement?.canAddProperty === false;

  const handleSubmit = async (data: PropertyFormValues) => {
    setPlanLimitHit(false);
    try {
      await createProperty.mutateAsync(data);
      navigate('/app/short-rent/properties');
    } catch (error) {
      if (isPlanLimitError(error)) {
        setPlanLimitHit(true);
        return;
      }
      throw error;
    }
  };

  return (
    <AppShell>
      <div className="space-y-6 max-w-4xl mx-auto">
        <PageHeader
          title={t('property.create.title')}
          description={t('property.create.description')}
        />

        {blockedByPlan && (
          <div
            role="alert"
            data-testid="plan-limit-alert"
            className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm"
          >
            <p className="font-medium text-destructive">{getPlanLimitMessage()}</p>
            <Link
              to={PLAN_UPGRADE_PATH}
              className="mt-1 inline-block font-medium text-primary underline underline-offset-2"
            >
              {getPlanUpgradeCta()}
            </Link>
          </div>
        )}

        <PropertyForm
          onSubmit={handleSubmit}
          isLoading={createProperty.isPending}
          disabled={blockedByPlan}
        />
      </div>
    </AppShell>
  );
}
