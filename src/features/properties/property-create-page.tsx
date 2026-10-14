import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ME_QUERY_KEY } from '@/lib/onboarding-gate';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { toast } from 'sonner';
import { PropertyForm } from './components/property-form';
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

export function PropertyCreatePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  // First property of a new host (`?first=1`, set by the onboarding): the short form, then the checklist asks the rest.
  const [searchParams] = useSearchParams();
  const quick = searchParams.get('first') === '1';
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
      if (quick) {
        toast.success(t('property.quick.created'));
        navigate('/app/short-rent');
        return;
      }
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
          title={quick ? t('property.quick.title') : t('property.create.title')}
          description={quick ? t('property.quick.description') : t('property.create.description')}
        />

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

        {quick ? (
          <QuickPropertyForm
            variant="short-rent"
            onSubmit={handleSubmit}
            isLoading={createProperty.isPending}
            disabled={blockedByPlan}
            onFullForm={() => navigate('/app/short-rent/properties/create')}
          />
        ) : (
          <PropertyForm
            onSubmit={handleSubmit}
            isLoading={createProperty.isPending}
            disabled={blockedByPlan}
          />
        )}
      </div>
    </AppShell>
  );
}
