import { useState } from 'react';
import { Navigate, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/layout/page-header';
import { LoadingScreen } from '@/components/shared/loading-screen';
import { WIZARD_DONE_STEP } from '@/components/shared/wizard/wizard-shell';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { getHttpStatus, getProblemMessage } from '@/lib/api-errors';
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
  propertyModeBasePath,
  type ModeArea,
  type ModeEntry,
} from './paths';

interface LoadErrorProps {
  error: unknown;
  onRetry: () => void;
}

/** A failed load, with the reason the server gave and a way to try again: never an empty page. A 404 is "not found", with no retry. */
function ModeLoadError({ error, onRetry }: LoadErrorProps) {
  const { t } = useTranslation();
  const notFound = getHttpStatus(error) === 404;

  return (
    <Alert
      variant="danger"
      data-testid="property-mode-load-error"
      action={
        notFound ? undefined : (
          <Button type="button" size="sm" variant="outline" className="min-h-11" onClick={onRetry}>
            {t('propertyMode.retry')}
          </Button>
        )
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
  /** The last screen is open: the first day possible is not needed any more. */
  doneStep: boolean;
  onScheduled: (change: PropertyModeChange) => void;
}

/**
 * Asks the server for the first day possible (what stands in the way of tomorrow, and why) before the wizard opens: the day
 * step needs it for its limits. On the last screen it is not waited for, so reloading it does not depend on a second request.
 */
function WizardLoader({ propertyId, propertyName, area, entry, currentMode, waiting, doneStep, onScheduled }: WizardLoaderProps) {
  const { t } = useTranslation();
  const tomorrow = addDays(todayInRome(), 1);
  const preview = usePropertyModePreview(propertyId, oppositeMode(currentMode), tomorrow, { enabled: !doneStep, fresh: true });

  if (!doneStep && preview.isLoading) {
    return <LoadingScreen message={t('propertyMode.loadingChecks')} className="h-auto flex-1" />;
  }
  if (!doneStep && preview.isError) {
    return <ModeLoadError error={preview.error} onRetry={() => void preview.refetch()} />;
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

/**
 * "Cambia modalità" (PM-03, D16): the wizard that programs the passage of a property from short stays to long-term leases, or
 * back, on a day. The same page serves both sections, at `/app/<section>/properties/:id/mode`; the one of the section the
 * property is in opens it, and the other redirects there. Behind the flag `propertyModeChange` (the route redirects to the home
 * of the area while it is off) and the permission to write the property.
 *
 * A property can have one change at a time: with one waiting the page says so and offers to withdraw it. `?from=account`
 * (the list of properties of the account, AM-13) makes the way out lead back there.
 */
function PropertyModeWizardPage({ area }: { area: ModeArea }) {
  const { t } = useTranslation();
  const { id = '' } = useParams<{ id: string }>();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const entry = entryFromSearch(searchParams);
  const property = useProperty(id, { fresh: true });
  const state = usePropertyModeState(id, { fresh: true });
  // Set when the change is programmed in this visit: the state the server sends next must not replace the confirmation.
  const [scheduledHere, setScheduledHere] = useState(false);

  if (property.isLoading || state.isLoading) {
    return <LoadingScreen message={t('propertyMode.loading')} className="h-auto flex-1" />;
  }

  const failure = property.isError ? property : state.isError ? state : null;
  if (failure || !property.data || !state.data) {
    return (
      <div className="mx-auto w-full max-w-2xl space-y-6">
        <PageHeader title={t('propertyMode.page.title')} />
        <ModeLoadError
          error={failure?.error}
          onRetry={() => {
            void property.refetch();
            void state.refetch();
          }}
        />
      </div>
    );
  }

  // A property is in one section: its mode decides which one opens the wizard (#246 does the same for its pages).
  const currentMode = state.data.rentalMode;
  const ownArea = areaOfMode(currentMode);
  if (ownArea !== area) {
    return <Navigate to={{ pathname: propertyModeBasePath(ownArea, id), search: location.search }} replace />;
  }

  const crumbs: PageCrumb[] = [
    { label: t('nav.properties'), to: listPathFor(area, entry) },
    { label: property.data.name, to: propertyDetailPath(area, id) },
    { label: t('propertyMode.page.title') },
  ];
  const waiting = state.data.scheduledChange;
  const doneStep = searchParams.get('step') === WIZARD_DONE_STEP;
  const backTo = exitPathFor(area, id, entry);

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6" data-testid="property-mode-page">
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

/** `/app/short-rent/properties/:id/mode` */
export function ShortRentPropertyModePage() {
  return <PropertyModeWizardPage area="short-rent" />;
}

/** `/app/long-rent/properties/:id/mode` */
export function LongRentPropertyModePage() {
  return <PropertyModeWizardPage area="long-rent" />;
}
