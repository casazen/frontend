import { useState } from 'react';
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/layout/page-header';
import { FOCUS_COLUMN } from '@/components/layout/page-columns';
import { LoadingScreen } from '@/components/shared/loading-screen';
import { WIZARD_DONE_STEP } from '@/components/shared/wizard/wizard-shell';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { getHttpStatus, getProblemMessage } from '@/lib/api-errors';
import { cn } from '@/lib/utils';
import type { PageCrumb } from '@/lib/page-crumbs';
import { addDays, todayInRome } from '@/lib/stay-dates';
import { usePropertyModePreview, usePropertyModeState } from '@/queries/use-property-mode';
import { useProperty } from '@/queries/use-properties';
import type { RentalMode } from '@/types/property.types';
import type { PropertyModeChange } from '@/types/property-mode.types';
import { ModeWizard } from './components/mode-wizard';
import { ScheduledChangePanel } from './components/scheduled-change-panel';
import {
  areaOfMode,
  entryFromSearch,
  exitPathFor,
  listPathFor,
  oppositeMode,
  propertyDetailPath,
  propertyModePath,
  type ModeArea,
  type ModeEntry,
} from './paths';

interface LoadErrorProps {
  error: unknown;
  onRetry: () => void;
  backTo: string;
}

/**
 * A load that failed with nothing to show yet, with the reason the server gave: never an empty page. A 404 is "not found" and
 * has no retry; the way back to the list is always there.
 */
function ModeLoadError({ error, onRetry, backTo }: LoadErrorProps) {
  const { t } = useTranslation();
  const notFound = getHttpStatus(error) === 404;

  return (
    <Alert
      variant="danger"
      data-testid="property-mode-load-error"
      action={
        <>
          {notFound ? null : (
            <Button type="button" size="sm" variant="outline" className="min-h-11" onClick={onRetry}>
              {t('propertyMode.retry')}
            </Button>
          )}
          <Button asChild size="sm" variant="ghost" className="min-h-11">
            <Link to={backTo} data-testid="property-mode-load-error-back">
              {t('propertyMode.done.backToList')}
            </Link>
          </Button>
        </>
      }
    >
      {notFound ? t('propertyMode.notFound') : (getProblemMessage(error, t) ?? t('propertyMode.loadFailed'))}
    </Alert>
  );
}

interface WizardLoaderProps {
  propertyId: string;
  propertyName: string;
  area: ModeArea;
  entry: ModeEntry;
  currentMode: RentalMode;
  waiting: PropertyModeChange | null;
  doneStep: boolean;
  onScheduled: () => void;
}

function WizardLoader({ propertyId, propertyName, area, entry, currentMode, waiting, doneStep, onScheduled }: WizardLoaderProps) {
  const { t } = useTranslation();
  const [tomorrow] = useState(() => addDays(todayInRome(), 1));
  const preview = usePropertyModePreview(propertyId, oppositeMode(currentMode), tomorrow, { enabled: !doneStep, fresh: true });

  if (!doneStep && !preview.data) {
    return preview.isError ? (
      <ModeLoadError error={preview.error} onRetry={() => void preview.refetch()} backTo={listPathFor(area, entry)} />
    ) : (
      <LoadingScreen message={t('propertyMode.loadingChecks')} className="h-auto flex-1" />
    );
  }

  return (
    <ModeWizard
      propertyId={propertyId}
      propertyName={propertyName}
      area={area}
      entry={entry}
      currentMode={currentMode}
      firstPreview={preview.data}
      waiting={waiting}
      onScheduled={onScheduled}
    />
  );
}

function PropertyModeWizardPage({ area }: { area: ModeArea }) {
  const { t } = useTranslation();
  const { id = '' } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const entry = entryFromSearch(searchParams);
  const property = useProperty(id, { fresh: true });
  const state = usePropertyModeState(id, { fresh: true });
  const [scheduledHere, setScheduledHere] = useState(false);

  if (!property.data || !state.data) {
    const failed = !property.data && property.isError ? property : !state.data && state.isError ? state : null;
    if (!failed) return <LoadingScreen message={t('propertyMode.loading')} className="h-auto flex-1" />;
    return (
      <div className={cn(FOCUS_COLUMN, 'space-y-6')}>
        <PageHeader title={t('propertyMode.page.title')} />
        <ModeLoadError
          error={failed.error}
          backTo={listPathFor(area, entry)}
          onRetry={() => {
            void property.refetch();
            void state.refetch();
          }}
        />
      </div>
    );
  }

  const currentMode = state.data.rentalMode;
  const ownArea = areaOfMode(currentMode);
  if (ownArea !== area) {
    return <Navigate to={propertyModePath(ownArea, id, entry)} replace />;
  }

  const crumbs: PageCrumb[] = [
    { label: t('nav.properties'), to: listPathFor(area, entry) },
    { label: property.data.name, to: propertyDetailPath(area, id) },
    { label: t('propertyMode.page.title') },
  ];
  const waiting = state.data.scheduledChange;
  const doneStep = searchParams.get('step') === WIZARD_DONE_STEP;
  const backTo = exitPathFor(area, id, entry);

  if (currentMode === 'Short' && !waiting) return <Navigate to={backTo} replace />;

  return (
    <div className={cn(FOCUS_COLUMN, 'space-y-6')} data-testid="property-mode-page">
      <PageHeader title={t('propertyMode.page.title')} description={property.data.name} crumbs={crumbs} />
      {waiting && !doneStep && !scheduledHere ? (
        <ScheduledChangePanel
          propertyId={id}
          propertyName={property.data.name}
          area={area}
          change={waiting}
          backTo={backTo}
        />
      ) : (
        <WizardLoader
          propertyId={id}
          propertyName={property.data.name}
          area={area}
          entry={entry}
          currentMode={currentMode}
          waiting={waiting}
          doneStep={doneStep}
          onScheduled={() => setScheduledHere(true)}
        />
      )}
    </div>
  );
}

export function ShortRentPropertyModePage() {
  const { id } = useParams<{ id: string }>();
  return <PropertyModeWizardPage key={id} area="short-rent" />;
}

export function LongRentPropertyModePage() {
  const { id } = useParams<{ id: string }>();
  return <PropertyModeWizardPage key={id} area="long-rent" />;
}
