import { useState } from 'react';
import { Link, Navigate, useNavigationType, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { FOCUS_COLUMN } from '@/components/layout/page-columns';
import { LoadingScreen } from '@/components/shared/loading-screen';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useComplianceActivation } from '@/features/compliance/use-compliance';
import { useFeatureFlags } from '@/hooks/use-feature-flags';
import { getHttpStatus, getProblemMessage } from '@/lib/api-errors';
import { cn } from '@/lib/utils';
import { useListingStatus } from '@/queries/use-listing-status';
import { useProperty } from '@/queries/use-properties';
import { longRentPropertyEditPath } from '../long-rent/paths';
import { PROPERTIES_PATH } from '../properties-paths';
import { importedSteps } from './channels-model';
import { PropertyWizard } from './property-wizard';
import { PROPERTY_ID_PARAM, resumeStepFor, type WizardStepId } from './property-wizard-model';
import { useWizardListingSeed } from './use-wizard-listing-seed';

/** A property that cannot be opened: said with the reason the server gave, with the way back to the list always there. */
function LoadError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const { t } = useTranslation();
  const notFound = getHttpStatus(error) === 404;

  return (
    <Alert
      variant="danger"
      data-testid="property-wizard-load-error"
      action={
        <>
          {notFound ? null : (
            <Button type="button" size="sm" variant="outline" className="min-h-11" onClick={onRetry}>
              {t('propertyWizard.page.retry')}
            </Button>
          )}
          <Button asChild size="sm" variant="ghost" className="min-h-11">
            <Link to={PROPERTIES_PATH}>{t('propertyWizard.page.backToList')}</Link>
          </Button>
        </>
      }
    >
      {notFound ? t('propertyWizard.page.notFound') : (getProblemMessage(error, t) ?? t('propertyWizard.page.loadFailed'))}
    </Alert>
  );
}

/**
 * The wizard reopened on a property (`?propertyId=`). The step it opens on, when the address names none, is the first that has a
 * blocker open, as the server tells it (`resumeStepFor`); a long-term property is not this wizard's: it goes to its own section. It opens
 * form starts from it, and a form that started without it would take it away with the first save.
 *
 * A listing that is already on the channels (published from here, or imported and mapped) opens on the steps that lack data, as the status
 * of its channels lists them, then the channels and the last step — the check of an imported listing (NF-29) — with «Mostra tutti i passi»
 * to see the rest. The list of steps is fixed when the wizard opens, so a step the host is on never disappears under them.
 */
function ResumeWizard({ propertyId, stepNamed }: { propertyId: string; stepNamed: boolean }) {
  const { t } = useTranslation();
  const connectorOn = useFeatureFlags().flags.octorateConnector;
  const property = useProperty(propertyId, { fresh: true });
  // Not needed when the address already names a step (a link to «Aggiungi foto»): the wizard opens there at once.
  const activation = useComplianceActivation(stepNamed ? '' : propertyId);
  const shortRent = property.data !== undefined && property.data.rentalMode !== 'Long';
  const listing = useWizardListingSeed(propertyId, shortRent);
  const channels = useListingStatus(propertyId, { enabled: connectorOn && shortRent });
  const [checked, setChecked] = useState<WizardStepId[] | null | undefined>(undefined);
  const [showAll, setShowAll] = useState(false);

  // Fixed once, when the status first arrives (or fails: the wizard then opens as it always did).
  if (checked === undefined && connectorOn && (channels.data !== undefined || channels.isError)) setChecked(importedSteps(channels.data));
  const waitingForStatus = connectorOn && shortRent && checked === undefined;

  if (property.isError && !property.data) return <LoadError error={property.error} onRetry={() => void property.refetch()} />;
  if (property.data?.rentalMode === 'Long') return <Navigate to={longRentPropertyEditPath(property.data.id)} replace />;
  if (listing.failed) return <LoadError error={listing.error} onRetry={listing.retry} />;
  if (!property.data || !listing.seed || waitingForStatus || (!stepNamed && !activation.data && !activation.isError)) {
    return <LoadingScreen message={t('propertyWizard.page.loading')} className="h-auto flex-1" />;
  }

  const onlySteps = checked && !showAll ? checked : undefined;
  const initialStepId = onlySteps
    ? stepNamed
      ? undefined
      : onlySteps[0]
    : !stepNamed && activation.data
      ? resumeStepFor(property.data, activation.data.steps)
      : undefined;

  return (
    <>
      {checked ? (
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-lg bg-muted p-4" data-testid="property-wizard-imported">
          <p className="min-w-0 flex-1 text-sm">{showAll ? t('propertyWizard.imported.all') : t('propertyWizard.imported.only')}</p>
          <label className="flex min-h-11 items-center gap-3 text-sm font-medium">
            <Switch checked={showAll} onCheckedChange={setShowAll} data-testid="property-wizard-show-all" />
            {t('propertyWizard.imported.showAll')}
          </label>
        </div>
      ) : null}
      <PropertyWizard key={propertyId} property={property.data} listing={listing.seed} onlySteps={onlySteps} initialStepId={initialStepId} />
    </>
  );
}

/**
 * `/app/short-rent/properties/create` (SR-07b): «Aggiungi immobile». It replaces the form of the creation; the first property of a new
 * host (`?first=1`) keeps its short form and does not come here.
 *
 * A property that appears in the address after the host's first «Avanti» is the one this very wizard created: it is the same wizard
 * going on, not a reason to start another (which would lose its answers), so only a property named by a link is reopened.
 */
export function PropertyWizardPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const navigationType = useNavigationType();
  const [createdHere, setCreatedHere] = useState<string | null>(null);
  /** Counts the wizards started in this visit: a new one is a new element, with nothing left of the last. */
  const [generation, setGeneration] = useState(0);
  const linkedPropertyId = searchParams.get(PROPERTY_ID_PARAM);
  const resumeId = linkedPropertyId && linkedPropertyId !== createdHere ? linkedPropertyId : null;

  // «Aggiungi immobile» opened again from the end of a wizard (a link to the empty address, the one that ended had made a property): a
  // new wizard, or its first «Avanti» would save over the property that has just been finished. Not the «back» of the browser, which
  // goes back to the first step of the same wizard; and the browser's address is read as well as the router's, because right after the
  // creation the router has not rendered the step that «Avanti» pushed yet.
  if (createdHere && navigationType === 'PUSH' && searchParams.toString() === '' && window.location.search === '') {
    setCreatedHere(null);
    setGeneration((current) => current + 1);
  }

  return (
    <AppShell>
      <div className={cn(FOCUS_COLUMN, 'space-y-6')} data-testid="property-wizard-page">
        <PageHeader title={t('propertyWizard.page.title')} description={t('propertyWizard.page.description')} crumbs="auto" />
        {resumeId ? (
          <ResumeWizard key={resumeId} propertyId={resumeId} stepNamed={searchParams.get('step') !== null} />
        ) : (
          <PropertyWizard key={`new-${generation}`} onCreated={setCreatedHere} />
        )}
      </div>
    </AppShell>
  );
}
