import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/layout/page-header';
import { useCreateProperty } from '@/queries/use-properties';
import { useEntitlement } from '@/queries/use-users';
import { getPlanLimitMessage, getPlanUpgradeCta, getPlanUpgradePath, isPlanLimitError } from '@/lib/entitlement-error';
import { PropertyForm } from '../components/property-form';
import type { CreatePropertyDto } from '@/types';
import { LONG_RENT_PROPERTIES_PATH, longRentPropertyPath } from './paths';

/** New long-term property: the owner lands on its page to upload the APE right away (A7-06). */
export function LongRentPropertyCreatePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const createProperty = useCreateProperty();
  const { data: entitlement } = useEntitlement();
  const [planLimitHit, setPlanLimitHit] = useState(false);

  // The server enforces the plan limit; the entitlement read only avoids filling a form that cannot be saved.
  const blockedByPlan = planLimitHit || entitlement?.canAddProperty === false;

  const handleSubmit = async (data: CreatePropertyDto) => {
    setPlanLimitHit(false);
    try {
      const created = await createProperty.mutateAsync(data);
      navigate(longRentPropertyPath(created.id));
    } catch (error) {
      // Other errors are shown by the mutation's toast; the form stays filled in.
      if (isPlanLimitError(error)) setPlanLimitHit(true);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader title={t('longRentProperties.create.title')} description={t('longRentProperties.create.description')} />

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

      <PropertyForm
        variant="long-rent"
        onSubmit={handleSubmit}
        onCancel={() => navigate(LONG_RENT_PROPERTIES_PATH)}
        isLoading={createProperty.isPending}
        disabled={blockedByPlan}
      />
    </div>
  );
}
