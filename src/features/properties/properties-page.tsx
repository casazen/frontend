import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { ConfirmationDialog } from '@/components/shared/confirmation-dialog';
import { ListView } from '@/components/shared/list-view/list-view';
import { CinDeadlineBanner } from '@/features/cin';
import { usePlanPagePath } from '@/hooks/use-billing-context';
import { useListViewsScope } from '@/hooks/use-list-views-scope';
import { useWorkspace } from '@/hooks/use-workspace';
import { getPlanLimitMessage, getPlanTierLabel, getPlanUpgradeCta } from '@/lib/i18n-labels';
import { useCinCompliance } from '@/queries/use-cin';
import { useActivateProperty, useDeleteProperty, usePauseProperty, useProperties } from '@/queries/use-properties';
import { useEntitlement } from '@/queries/use-users';
import type { Property } from '@/types';
import { usePropertiesList } from './properties-list';
import { PROPERTY_CREATE_PATH } from './properties-paths';

/** From this many properties on, the limit of a plan is "no limit" (the API sends a very large number, or a negative one). */
const UNLIMITED_PROPERTIES = 1_000_000;

/** The plan counts every property of the org, short and long: "Piano Pro: 3 di 50 immobili". Nothing until the plan is known. */
function PlanUsageNote() {
  const { t } = useTranslation();
  const { data: entitlement } = useEntitlement();
  const planPath = usePlanPagePath();
  // The answer is trusted as far as it has the two numbers: a note with holes in it is no note, and it never takes the page down.
  const max = entitlement?.limits?.maxProperties;
  const used = entitlement?.usage?.properties;
  if (!entitlement || typeof max !== 'number' || typeof used !== 'number') return null;

  const plan = getPlanTierLabel(entitlement.planTier, t);
  const unlimited = max < 0 || max >= UNLIMITED_PROPERTIES;

  return (
    <p className="text-sm text-foreground/70" data-testid="properties-plan-note">
      {unlimited ? t('property.list.plan.usageUnlimited', { plan, used }) : t('property.list.plan.usage', { plan, used, max })}
      {entitlement.canAddProperty ? null : (
        <>
          {' '}
          {getPlanLimitMessage()}.
          {planPath ? (
            <>
              {' '}
              <Link to={planPath} className="font-medium text-primary underline underline-offset-4">
                {getPlanUpgradeCta()}
              </Link>
            </>
          ) : null}
        </>
      )}
    </p>
  );
}

/**
 * Immobili (SR-07): the properties of Affitti brevi in the unified list, one state each (`propertyStatus`), the one thing to do
 * about it and the rest in "⋯". The name opens the drawer of the property (UI-15); the page of the property, its form and the
 * creation of a new one are the pages they always were. At most 50 properties, so it is one request and the list filters it itself.
 */
export function PropertiesPage() {
  const { t } = useTranslation();
  const { data: properties, isLoading, isError, error, refetch } = useProperties({ mode: 'short' }, { fresh: true });
  const { data: cinCompliance } = useCinCompliance();
  const { mutate: pause, isPending: pausing } = usePauseProperty();
  const { mutate: activate, isPending: activating } = useActivateProperty();
  const deleteProperty = useDeleteProperty();
  const { hasPermission } = useWorkspace();
  const viewsScope = useListViewsScope();
  const canWrite = hasPermission('short-rent', 'property.write');
  const [propertyToDelete, setPropertyToDelete] = useState<Property | null>(null);

  // Pausing and activating are dedicated actions (A2-05): never the generic PUT, so they can never fail on an unrelated required
  // field, and never set `isActive` (soft delete's own flag, PC-05). The mutations tell the person themselves how they went.
  const onPause = useCallback((property: Property) => pause(property.id), [pause]);
  const onActivate = useCallback((property: Property) => activate(property.id), [activate]);
  const onDelete = useCallback((property: Property) => setPropertyToDelete(property), []);

  const list = usePropertiesList({
    canWrite,
    canReadBookings: hasPermission('short-rent', 'booking.read'),
    busy: pausing || activating || deleteProperty.isPending,
    onPause,
    onActivate,
    onDelete,
  });

  // The backend decides whether it can go (409 with upcoming bookings / active leases): the mutation's own toast says why.
  const confirmDelete = async () => {
    if (!propertyToDelete) return;
    try {
      await deleteProperty.mutateAsync(propertyToDelete.id);
    } catch {
      // Error toast already handled by the mutation
    }
  };

  return (
    <div className="min-w-0 space-y-6" data-testid="properties-page">
      {cinCompliance?.summary ? <CinDeadlineBanner summary={cinCompliance.summary} /> : null}

      <PageHeader
        title={t('property.page.title')}
        description={t('property.page.description')}
        crumbs="auto"
        primary={canWrite ? { label: t('property.page.addButton'), icon: Plus, to: PROPERTY_CREATE_PATH, testId: 'property-add' } : undefined}
      />

      <ListView
        list={list}
        rows={properties ?? []}
        isLoading={isLoading}
        isError={isError && !properties}
        error={error}
        errorTitle={t('property.page.errorLoad')}
        onRetry={() => void refetch()}
        viewsScope={viewsScope}
        testId="properties-list"
      />

      <PlanUsageNote />

      <ConfirmationDialog
        open={propertyToDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPropertyToDelete(null);
        }}
        title={t('property.deleteDialog.title')}
        description={t('property.deleteDialog.description', { name: propertyToDelete?.name ?? '' })}
        confirmLabel={t('property.deleteDialog.confirm')}
        variant="destructive"
        requireText={propertyToDelete?.name ?? ''}
        consequences={[t('property.deleteDialog.consequenceHidden'), t('property.deleteDialog.consequenceBlocked')]}
        onConfirm={confirmDelete}
        isLoading={deleteProperty.isPending}
      />
    </div>
  );
}
