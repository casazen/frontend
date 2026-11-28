import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ME_QUERY_KEY } from '@/lib/onboarding-gate';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { FOCUS_COLUMN } from '@/components/layout/page-columns';
import { QuickPropertyForm } from './components/quick-property-form';
import { useCreateProperty } from '@/queries/use-properties';
import { useEntitlement } from '@/queries/use-users';
import {
  isPlanLimitError,
  getPlanLimitMessage,
  getPlanUpgradeCta,
  getPlanUpgradePath,
} from '@/lib/entitlement-error';
import type { CreatePropertyDto } from '@/types';
import { PropertyWizardPage } from './wizard/property-wizard-page';

function FirstPropertyPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const createProperty = useCreateProperty('Short');
  const queryClient = useQueryClient();
  const { data: entitlement } = useEntitlement();
  const [planLimitHit, setPlanLimitHit] = useState(false);

  const blockedByPlan = planLimitHit || entitlement?.canAddProperty === false;

  const handleSubmit = async (data: CreatePropertyDto) => {
    setPlanLimitHit(false);
    try {
      await createProperty.mutateAsync(data);
      await queryClient.invalidateQueries({ queryKey: ME_QUERY_KEY });
      navigate('/app/short-rent');
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
      <div className="space-y-6">
        <PageHeader title={t('property.quick.title')} description={t('property.quick.description')} />

        {blockedByPlan && (
          <div
            role="alert"
            data-testid="plan-limit-alert"
            className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm"
          >
            <p className="font-medium text-destructive">{getPlanLimitMessage()}</p>
            <Link
              to={getPlanUpgradePath('short-rent')}
              className="mt-1 inline-block font-medium text-primary underline underline-offset-2"
            >
              {getPlanUpgradeCta()}
            </Link>
          </div>
        )}

        <div className={FOCUS_COLUMN}>
          <QuickPropertyForm
            variant="short-rent"
            onSubmit={handleSubmit}
            isLoading={createProperty.isPending}
            disabled={blockedByPlan}
            onFullForm={() => navigate('/app/short-rent/properties/create')}
          />
        </div>
      </div>
    </AppShell>
  );
}

export function PropertyCreatePage() {
  const [searchParams] = useSearchParams();
  return searchParams.get('first') === '1' ? <FirstPropertyPage /> : <PropertyWizardPage />;
}
