import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ME_QUERY_KEY } from '@/lib/onboarding-gate';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/layout/page-header';
import { FOCUS_COLUMN } from '@/components/layout/page-columns';
import { useCreateProperty } from '@/queries/use-properties';
import { useEntitlement } from '@/queries/use-users';
import { getPlanLimitMessage, getPlanUpgradeCta, getPlanUpgradePath, isPlanLimitError } from '@/lib/entitlement-error';
import { toast } from 'sonner';
import { QuickPropertyForm } from '../components/quick-property-form';
import type { CreatePropertyDto } from '@/types';
import { isDuplicateAddressError } from '../property-errors';
import { LONG_RENT_PROPERTIES_PATH } from './paths';
import { LongRentPropertyWizard } from './wizard/long-rent-property-wizard';

const LONG_RENT_LEASES_PATH = '/app/long-rent/leases';

/**
 * New long-term property. The first property of a new landlord (`?first=1`, set by the onboarding) is the short form, and then the
 * guide of the first steps asks the rest; any other is the wizard "Aggiungi immobile" (LR-07c), which ends on "Crea il contratto".
 */
export function LongRentPropertyCreatePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const quick = searchParams.get('first') === '1';
  const createProperty = useCreateProperty('Long');
  const queryClient = useQueryClient();
  const { data: entitlement } = useEntitlement();
  const [planLimitHit, setPlanLimitHit] = useState(false);

  // The server enforces the plan limit; the entitlement read only avoids filling a form that cannot be saved.
  const blockedByPlan = planLimitHit || entitlement?.canAddProperty === false;

  // The short form of the first property: it creates and goes to the guide, which asks for the APE and the contract.
  const handleQuickSubmit = async (data: CreatePropertyDto) => {
    setPlanLimitHit(false);
    try {
      await createProperty.mutateAsync(data);
      // The profile carries `hasProperties`: refresh it before leaving, or the guard would send the host back here.
      await queryClient.invalidateQueries({ queryKey: ME_QUERY_KEY });
      toast.success(t('property.quick.created'));
      navigate(LONG_RENT_LEASES_PATH);
    } catch (error) {
      // Other errors are shown by the mutation's toast; the form stays filled in. A duplicate address goes back to the
      // form, which shows it under the address field (PC-06).
      if (isPlanLimitError(error)) setPlanLimitHit(true);
      else if (isDuplicateAddressError(error)) throw error;
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={quick ? t('property.quick.title') : t('longRentProperties.create.title')}
        description={quick ? t('property.quick.description') : t('longRentProperties.create.description')}
      />

      {blockedByPlan && (
        <div
          role="alert"
          data-testid="plan-limit-alert"
          className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm"
        >
          <p className="font-medium text-destructive">{getPlanLimitMessage()}</p>
          {/* The plan page of the long-rent shell (PL-16): never the short-rent one. */}
          <Link
            to={getPlanUpgradePath('long-rent')}
            className="mt-1 inline-block font-medium text-primary underline underline-offset-2"
            data-testid="plan-upgrade-link"
          >
            {getPlanUpgradeCta()}
          </Link>
        </div>
      )}

      {quick ? (
        <div className={FOCUS_COLUMN}>
          <QuickPropertyForm
            variant="long-rent"
            onSubmit={handleQuickSubmit}
            isLoading={createProperty.isPending}
            disabled={blockedByPlan}
            onFullForm={() => navigate('/app/long-rent/properties/new')}
          />
        </div>
      ) : blockedByPlan ? null : (
        // Over the plan there is nothing to fill in: the notice above says why and where to go. What was typed stays in the draft.
        <div className={FOCUS_COLUMN}>
          <LongRentPropertyWizard onPlanLimit={() => setPlanLimitHit(true)} onExit={() => navigate(LONG_RENT_PROPERTIES_PATH)} />
        </div>
      )}
    </div>
  );
}
