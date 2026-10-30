import { useState } from 'react';
import { Link, Navigate, useNavigationType, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { FOCUS_COLUMN } from '@/components/layout/page-columns';
import { LoadingScreen } from '@/components/shared/loading-screen';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useComplianceActivation } from '@/features/compliance/use-compliance';
import { getHttpStatus, getProblemMessage } from '@/lib/api-errors';
import { cn } from '@/lib/utils';
import { useProperty } from '@/queries/use-properties';
import { longRentPropertyEditPath } from '../long-rent/paths';
import { PROPERTIES_PATH } from '../properties-paths';
import { PropertyWizard } from './property-wizard';
import { PROPERTY_ID_PARAM, resumeStepFor } from './property-wizard-model';

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
 * blocker open, as the server tells it (`resumeStepFor`); a long-term property is not this wizard's: it goes to its own section.
 */
function ResumeWizard({ propertyId, stepNamed }: { propertyId: string; stepNamed: boolean }) {
  const { t } = useTranslation();
  const property = useProperty(propertyId, { fresh: true });
  // Not needed when the address already names a step (a link to «Aggiungi foto»): the wizard opens there at once.
  const activation = useComplianceActivation(stepNamed ? '' : propertyId);

  if (property.isError && !property.data) return <LoadError error={property.error} onRetry={() => void property.refetch()} />;
  if (!property.data || (!stepNamed && !activation.data && !activation.isError)) {
    return <LoadingScreen message={t('propertyWizard.page.loading')} className="h-auto flex-1" />;
  }
  if (property.data.rentalMode === 'Long') return <Navigate to={longRentPropertyEditPath(property.data.id)} replace />;

  const initialStepId = !stepNamed && activation.data ? resumeStepFor(property.data, activation.data.steps) : undefined;
  return <PropertyWizard key={propertyId} property={property.data} initialStepId={initialStepId} />;
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
