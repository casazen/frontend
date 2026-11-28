import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Plus, Sparkles } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { ConfirmationDialog } from '@/components/shared/confirmation-dialog';
import { ListView } from '@/components/shared/list-view/list-view';
import { CinDeadlineBanner } from '@/features/cin';
import { usePlanPagePath } from '@/hooks/use-billing-context';
import { useFeatureFlags } from '@/hooks/use-feature-flags';
import { useListViewsScope } from '@/hooks/use-list-views-scope';
import { useWorkspace } from '@/hooks/use-workspace';
import { getPlanLimitMessage, getPlanTierLabel, getPlanUpgradeCta } from '@/lib/i18n-labels';
import { useCinCompliance } from '@/queries/use-cin';
import { useListingStatusSummary } from '@/queries/use-listing-status';
import { SHORT_PROPERTIES_OVERVIEW, useActivateProperty, useDeleteProperty, usePauseProperty, useProperties } from '@/queries/use-properties';
import { useCurrentUser, useEntitlement } from '@/queries/use-users';
import type { Property } from '@/types';
import { BulkCleaningDialog } from './components/bulk-cleaning-dialog';
import { usePropertiesList } from './properties-list';
import { propertyStepLabel, readPropertyStep } from './wizard/property-setup-progress';
import { propertyWizardPath, PROPERTY_CREATE_PATH } from './properties-paths';

const UNLIMITED_PROPERTIES = 1_000_000;

function PlanUsageNote() {
  const { t } = useTranslation();
  const { data: entitlement } = useEntitlement();
  const planPath = usePlanPagePath();
  const max = entitlement?.limits?.maxProperties;
  const used = entitlement?.usage?.properties;
  if (
    !entitlement ||
    entitlement.isAgency ||
    entitlement.planTier === 'Agency' ||
    typeof max !== 'number' ||
    typeof used !== 'number'
  ) return null;

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
  const { data: properties, isLoading, isError, error, refetch } = useProperties(SHORT_PROPERTIES_OVERVIEW, { fresh: true });
  const { data: cinCompliance } = useCinCompliance();
  const { mutate: pause, isPending: pausing } = usePauseProperty();
  const { mutate: activate, isPending: activating } = useActivateProperty();
  const deleteProperty = useDeleteProperty();
  const { hasPermission } = useWorkspace();
  const viewsScope = useListViewsScope();
  const { user, org } = useCurrentUser();
  const progress = user?.id && org?.id ? readPropertyStep({ userId: user.id, orgId: org.id }) : null;
  const inProgress = !isError && properties?.find(property => property.id === progress?.propertyId);
  const canWrite = hasPermission('short-rent', 'property.write');
  const [propertyToDelete, setPropertyToDelete] = useState<Property | null>(null);
  const routinesOn = useFeatureFlags().flags.routines;
  const [cleanersOpen, setCleanersOpen] = useState(false);
  const canSetCleaners = canWrite && routinesOn;
  // The state of each property on the channels (E02/F03/US01/T04): only where the channel manager is connected, the endpoint answers 404 otherwise.
  const connectorOn = useFeatureFlags().flags.octorateConnector;
  const summaries = useListingStatusSummary(connectorOn);
  const channelSummaries = useMemo(
    () => (connectorOn ? new Map((summaries.data ?? []).map((summary) => [summary.propertyId, summary])) : null),
    [connectorOn, summaries.data],
  );

  const onPause = useCallback((property: Property) => pause(property.id), [pause]);
  const onActivate = useCallback((property: Property) => activate(property.id), [activate]);

  const list = usePropertiesList({
    canWrite,
    canReadBookings: hasPermission('short-rent', 'booking.read'),
    busy: pausing || activating || deleteProperty.isPending,
    onPause,
    onActivate,
    onDelete: setPropertyToDelete,
    channelSummaries,
    channelsKnown: summaries.isSuccess,
  });

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
      <PageHeader
        title={t('property.page.title')}
        crumbs="auto"
        primary={canWrite ? { label: t('property.page.addButton'), icon: Plus, to: PROPERTY_CREATE_PATH, testId: 'property-add' } : undefined}
        secondary={
          canSetCleaners
            ? [{ label: t('propertyCleaning.bulk.open'), icon: Sparkles, onClick: () => setCleanersOpen(true), testId: 'property-cleaning-bulk-open' }]
            : undefined
        }
      />

      {cinCompliance?.summary ? <CinDeadlineBanner summary={cinCompliance.summary} /> : null}

      {canWrite && progress && inProgress ? (
        <section aria-labelledby="property-resume-title" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4">
          <div className="min-w-0">
            <h2 id="property-resume-title" className="break-words font-semibold">{t('propertySetup.resume.listTitle', { name: inProgress.name })}</h2>
            <p className="text-sm text-muted-foreground">{t('propertySetup.resume.lastStep', { step: t(propertyStepLabel(progress.step)) })}</p>
          </div>
          <Button asChild variant="outline" className="min-h-11" data-testid="property-setup-resume">
            <Link to={propertyWizardPath(inProgress.id, progress.step)}>{t('propertySetup.resume.action')} <ArrowRight aria-hidden="true" /></Link>
          </Button>
        </section>
      ) : null}

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

      {canSetCleaners ? <BulkCleaningDialog open={cleanersOpen} onOpenChange={setCleanersOpen} /> : null}

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
