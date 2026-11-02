import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ME_QUERY_KEY } from '@/lib/onboarding-gate';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { FOCUS_COLUMN } from '@/components/layout/page-columns';
import { toast } from 'sonner';
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

/**
 * The first property of a new host (`?first=1`, set by the onboarding): the short form, then the checklist asks the rest. The
 * onboarding and the Golden Journey go through it (SR-D47), so the wizard does not replace it.
 */
function FirstPropertyPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const createProperty = useCreateProperty('Short');
  const queryClient = useQueryClient();
  const { data: entitlement } = useEntitlement();
  const [planLimitHit, setPlanLimitHit] = useState(false);

  // Block on a proactive entitlement read OR a server 403/409 we just caught.
  // The server stays the source of truth — a stale client cannot bypass the limit (AC8/AC12).
  const blockedByPlan = planLimitHit || entitlement?.canAddProperty === false;

  const handleSubmit = async (data: CreatePropertyDto) => {
    setPlanLimitHit(false);
    try {
      await createProperty.mutateAsync(data);
      // The profile carries `hasProperties`: refresh it before leaving, or the guard would send the host back here.
      await queryClient.invalidateQueries({ queryKey: ME_QUERY_KEY });
      toast.success(t('property.quick.created'));
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

/**
 * `/app/short-rent/properties/create`: «Aggiungi immobile» (SR-07b), the guided flow that replaces the form. The first property of a
 * new host (`?first=1`) keeps its short form: it is the destination of the onboarding guard.
 */
export function PropertyCreatePage() {
  const [searchParams] = useSearchParams();
  return searchParams.get('first') === '1' ? <FirstPropertyPage /> : <PropertyWizardPage />;
}
