import { useState } from 'react';
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom';
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
  propertyModePath,
  type ModeArea,
  type ModeEntry,
} from './paths';

interface LoadErrorProps {
  error: unknown;
  onRetry: () => void;
  /** The list the person came from: every state has a way on (a 404 has nothing else). */
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
  /** The last screen is open: the first day possible is not needed any more. */
  doneStep: boolean;
  onScheduled: () => void;
}

/**
 * Asks the server for the first day possible (what stands in the way of tomorrow, and why) before the wizard opens: the day
 * step needs it for its limits, and the wizard starts from the answer of this visit (a preview is not kept once nobody shows it).
 * On the last screen it is not waited for, so reloading it does not depend on a second request. Once the wizard is open a failed
 * refresh of the answer does not take it away: the data stays, and the steps ask again for what they show.
 */
function WizardLoader({ propertyId, propertyName, area, entry, currentMode, waiting, doneStep, onScheduled }: WizardLoaderProps) {
  const { t } = useTranslation();
  // The day the first question is about, fixed for this visit: a wizard left open across midnight must not change its question.
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

/**
 * "Cambia modalità" (PM-03, D16): the wizard that programs the passage of a property from short stays to long-term leases, or
 * back, on a day. The same page serves both sections, at `/app/<section>/properties/:id/mode`; the one of the section the
 * property is in opens it, and the other redirects there. Behind the permission to write the property.
 *
 * A property can have one change at a time: with one waiting the page says so and offers to withdraw it. `?from=account`
 * (the list of properties of the account, AM-13) makes the way out lead back there.
 */
function PropertyModeWizardPage({ area }: { area: ModeArea }) {
  const { t } = useTranslation();
  const { id = '' } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const entry = entryFromSearch(searchParams);
  const property = useProperty(id, { fresh: true });
  const state = usePropertyModeState(id, { fresh: true });
  // Set when the change is programmed in this visit: the state the server sends next must not replace the confirmation.
  const [scheduledHere, setScheduledHere] = useState(false);

  // Nothing to show yet. A failed refresh while there is something on screen is not a reason to take it away (the confirmation
  // of a change that was programmed must not turn into "could not load"): only a load that has no data fails the page.
  if (!property.data || !state.data) {
    const failed = !property.data && property.isError ? property : !state.data && state.isError ? state : null;
    if (!failed) return <LoadingScreen message={t('propertyMode.loading')} className="h-auto flex-1" />;
    return (
      <div className="mx-auto w-full max-w-2xl space-y-6">
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

  // A property is in one section: its mode decides which one opens the wizard (#246 does the same for its pages). The step is not
  // taken along: the other section asks the other question, from its beginning; only where the person came from is kept.
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

/**
 * `/app/short-rent/properties/:id/mode`. Keyed by the property: going from the wizard of one property to the one of another
 * (history) must not carry the answers, the step and the "programmed here" flag of the first over to the second.
 */
export function ShortRentPropertyModePage() {
  const { id } = useParams<{ id: string }>();
  return <PropertyModeWizardPage key={id} area="short-rent" />;
}

/** `/app/long-rent/properties/:id/mode` (keyed like the other one). */
export function LongRentPropertyModePage() {
  const { id } = useParams<{ id: string }>();
  return <PropertyModeWizardPage key={id} area="long-rent" />;
}
