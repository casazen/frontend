import { useId, type ReactNode } from 'react';
import { CheckCircle2, CircleDashed, type LucideIcon } from 'lucide-react';
import { Link, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AppShell } from '@/components/layout/app-shell';
import { FOCUS_COLUMN } from '@/components/layout/page-columns';
import { PageHeader } from '@/components/layout/page-header';
import { ErrorState } from '@/components/shared/error-state';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useFeatureFlags } from '@/hooks/use-feature-flags';
import { useOrg } from '@/hooks/useOrg';
import { useWorkspace } from '@/hooks/use-workspace';
import { getHttpStatus } from '@/lib/api-errors';
import { ONBOARDING_PLAN_PATH } from '@/lib/onboarding-parts';
import { isOrgBillingAdmin } from '@/lib/org-billing-admin';
import {
  OWNER_PHASES,
  ownerPhaseStateKey,
  ownerPhaseStates,
  ownerPhaseTitleKey,
  ownerPhaseWhatKey,
  type OwnerPhase,
  type OwnerPhaseState,
} from '@/lib/owner-onboarding';
import type { StatusTone } from '@/lib/status-dictionary';
import { cn } from '@/lib/utils';
import { useOnboardingPlan } from '@/queries/use-onboarding-plan';
import { useOwnerReadiness } from '@/queries/use-owner-onboarding';
import type { OwnerReadinessReport } from '@/types/owner-onboarding.types';
import { OwnerImportPanel } from './components/owner-import-panel';
import { OwnerInvitationPanel } from './components/owner-invitation-panel';
import { Mark, OwnerReadinessTable, PropertyShareList, ReadyMark, ReasonLine } from './components/owner-readiness-table';

/** At least 44 px high on every device, and a long label wraps instead of pushing the page sideways. */
const TOUCH_TARGET = 'h-auto min-h-11 whitespace-normal py-2 text-center leading-tight';

/** How many properties and owners the outcome card names before it says «and N more»: the phases below hold the whole list. */
const OUTCOME_LIST_LIMIT = 4;

/** The summary path of the plan, where the traffic light of the flows of the properties is. */
const PLAN_SUMMARY_PATH = `${ONBOARDING_PLAN_PATH}/summary`;

interface OutcomesProps {
  report: OwnerReadinessReport;
  activated: boolean | null;
}

/**
 * The two outcomes of the activation, told apart on purpose (E10/F03/US05/T01, AC-NF109-6): the properties that work with the channels, and the accounting for the
 * owners. Missing owners never block the first and keep the second «to complete», with the exact properties and fields. Neither card is a promise the other makes:
 * the first says nothing while the plan could not be read.
 */
function Outcomes({ report, activated }: OutcomesProps) {
  const { t } = useTranslation();
  const { summary } = report;
  const properties = report.properties;
  const owners = report.owners.filter((owner) => !owner.accountingReady);

  return (
    <section aria-label={t('ownerOnboarding.outcomes.label')} className="grid grid-cols-1 gap-4 sm:grid-cols-2" data-testid="owner-outcomes">
      <div className="min-w-0 space-y-2 rounded-lg border p-4" data-testid="owner-outcome-operational">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-base font-semibold">{t('ownerOnboarding.outcomes.operational.title')}</h2>
          {activated === null ? null : <ReadyMark ready={activated} testId="owner-outcome-operational-state" />}
        </div>
        <p className="text-sm text-foreground/70">
          {activated === null ? t('ownerOnboarding.outcomes.operational.unknown') : t('ownerOnboarding.outcomes.operational.what')}
        </p>
        <Button asChild variant="ghost" className={TOUCH_TARGET}>
          <Link to={PLAN_SUMMARY_PATH}>{t('ownerOnboarding.outcomes.operational.link')}</Link>
        </Button>
      </div>

      <div className="min-w-0 space-y-2 rounded-lg border p-4" data-testid="owner-outcome-accounting">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-base font-semibold">{t('ownerOnboarding.outcomes.accounting.title')}</h2>
          <ReadyMark ready={summary.financialReady} testId="owner-outcome-accounting-state" />
        </div>
        <p className="text-sm text-foreground/70">{t('ownerOnboarding.outcomes.accounting.what')}</p>
        {summary.financialReady ? null : (
          <div className="space-y-2 text-sm" data-testid="owner-outcome-missing">
            {summary.owners === 0 ? <p>{t('ownerOnboarding.outcomes.accounting.noOwners')}</p> : null}
            {properties.length > 0 ? (
              <div>
                <p className="font-semibold">{t('ownerOnboarding.outcomes.accounting.properties', { count: summary.propertiesWithoutOwner + summary.propertiesToComplete })}</p>
                <ul role="list" className="list-disc space-y-0.5 pl-5">
                  {properties.slice(0, OUTCOME_LIST_LIMIT).map((property) => (
                    <li key={property.propertyId} className="break-words">
                      {property.name}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {owners.length > 0 ? (
              <div>
                <p className="font-semibold">{t('ownerOnboarding.outcomes.accounting.owners', { count: owners.length })}</p>
                <ul role="list" className="list-disc space-y-0.5 pl-5">
                  {owners.slice(0, OUTCOME_LIST_LIMIT).map((owner) => (
                    <li key={owner.ownerId} className="break-words">
                      {owner.displayName}: {owner.reasons.slice(0, 2).map((reason, index) => (
                        <span key={`${reason.code}-${index}`}>
                          {index > 0 ? '; ' : ''}
                          <ReasonLine reason={reason} />
                        </span>
                      ))}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <p className="text-foreground/70">{t('ownerOnboarding.outcomes.accounting.notBlocking')}</p>
          </div>
        )}
      </div>
    </section>
  );
}

/** How each state of a phase looks: a tone, an icon and (in the translations) its words, so that a state is never told by color alone. */
const PHASE_TONES: Record<OwnerPhaseState, { tone: StatusTone; Icon: LucideIcon }> = {
  notStarted: { tone: 'neutral', Icon: CircleDashed },
  toComplete: { tone: 'warning', Icon: CircleDashed },
  done: { tone: 'success', Icon: CheckCircle2 },
};

interface PhaseProps {
  phase: OwnerPhase;
  index: number;
  state: OwnerPhaseState;
  highlighted: boolean;
  children: ReactNode;
}

/** One of the four phases: its number and title, where it stands in words, what it is for and its content. The first one to complete is the highlighted block. */
function Phase({ phase, index, state, highlighted, children }: PhaseProps) {
  const { t } = useTranslation();
  const headingId = useId();
  return (
    <li
      className={cn('min-w-0 space-y-3 rounded-lg border p-4', highlighted && 'border-primary/30 bg-primary/5')}
      data-testid={`owner-phase-${phase}`}
      data-state={state}
      data-highlighted={highlighted ? 'true' : undefined}
    >
      <section aria-labelledby={headingId} className="min-w-0 space-y-3">
        <div className="space-y-1">
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
            <h2 id={headingId} className="break-words text-base font-semibold leading-snug">
              {index + 1}. {t(ownerPhaseTitleKey(phase))}
            </h2>
            <Mark tone={PHASE_TONES[state].tone} Icon={PHASE_TONES[state].Icon} label={t(ownerPhaseStateKey(state))} testId={`owner-phase-${phase}-state`} />
          </div>
          <p className="break-words text-sm text-foreground/70">{t(ownerPhaseWhatKey(phase))}</p>
        </div>
        {children}
      </section>
    </li>
  );
}

/**
 * `/app/short-rent/onboarding/owners`, the owner step of «Inizia con CasaZen» (E10/F03/US05/T01, NF-109, ONB-06), for an organization on the agency plan: four phases
 * (the owners, their associations and shares, the data for the statements, the access to the portal) and, above them, the two outcomes told apart (the properties
 * that work, and the accounting for the owners). It reads the readiness the server derives on every visit and orchestrates the import and the invitations; it keeps
 * nothing «done» by itself. Each phase says where it stands in words as well as in color.
 *
 * Who may see it follows the backend: with the flag of the agency plan off the address leads back to the plan and nothing is read; the owners are the organization
 * administrator's (the agency permissions of the owner and the administrators), and anyone else is told so and no request is sent, because a refusal to a read would
 * send the whole app to the page of no access. A page that cannot read the readiness says so (never «all in order»), and a 404 is «not found» even when an older
 * answer is still in memory.
 */
export function OwnerOnboardingPage() {
  const { t } = useTranslation();
  const { contexts } = useWorkspace();
  const { flags } = useFeatureFlags();
  const { isAgency, isLoading: orgLoading } = useOrg();
  const isAdmin = isOrgBillingAdmin(contexts);
  // The server asks the agency plan and the agency permission of the owner and the administrators: nothing is read for anyone else, because a refused read
  // sends the whole app to the page of no access.
  const allowed = flags.agencyTier && isAgency && isAdmin;
  const readiness = useOwnerReadiness(allowed);
  const plan = useOnboardingPlan({ enabled: allowed });

  // The agency plan is off (the flag, or the plan of this org): this step does not exist, and the plan is where the person was.
  if (!flags.agencyTier || (!orgLoading && !isAgency)) return <Navigate to={ONBOARDING_PLAN_PATH} replace />;

  // An error of a read comes before the data it leaves in memory when it is a 404: «not found», whatever an older answer was (the module is off). Any other failure of the
  // first read is told with a retry, and a failure of a later read (the refresh every thirty seconds, the return to the tab) keeps the page, with the last answer and a notice
  // that it could not be updated: a page that went away would take with it the file the person chose, the check of it and the row being typed. None reads as «all in order».
  const notFound = readiness.isError && getHttpStatus(readiness.error) === 404;
  const report = notFound ? null : (readiness.data ?? null);
  const updateFailed = readiness.isError && !notFound && report !== null;
  const activated = plan.isError || plan.data === undefined ? null : plan.data.activated;

  let content: ReactNode;
  if (orgLoading) {
    content = (
      <div role="status" aria-busy="true" className="space-y-3" data-testid="owner-onboarding-loading">
        <span className="sr-only">{t('ownerOnboarding.loading')}</span>
        <Skeleton className="h-24 w-full rounded-lg motion-reduce:animate-none" aria-hidden="true" />
      </div>
    );
  } else if (!isAdmin) {
    content = (
      <p className="text-sm text-foreground/70" data-testid="owner-onboarding-admin-only">
        {t('ownerOnboarding.adminOnly')}
      </p>
    );
  } else if (notFound) {
    content = (
      <Alert variant="info" data-testid="owner-onboarding-not-found">
        {t('ownerOnboarding.notFound')}
      </Alert>
    );
  } else if (readiness.isLoading) {
    content = (
      <div role="status" aria-busy="true" className="space-y-3" data-testid="owner-onboarding-loading">
        <span className="sr-only">{t('ownerOnboarding.loading')}</span>
        <Skeleton className="h-24 w-full rounded-lg motion-reduce:animate-none" aria-hidden="true" />
        <Skeleton className="h-24 w-full rounded-lg motion-reduce:animate-none" aria-hidden="true" />
        <Skeleton className="h-24 w-full rounded-lg motion-reduce:animate-none" aria-hidden="true" />
      </div>
    );
  } else if (report === null) {
    content = (
      <ErrorState testId="owner-onboarding-error" title={t('ownerOnboarding.loadError')} error={readiness.error} onRetry={() => void readiness.refetch()} showSupport />
    );
  } else {
    const states = ownerPhaseStates(report);
    const focus = OWNER_PHASES.find((phase) => states[phase] !== 'done') ?? null;
    content = (
      <>
        {updateFailed ? (
          <Alert
            variant="warning"
            role="alert"
            data-testid="owner-onboarding-update-failed"
            action={
              <Button type="button" size="sm" variant="outline" className="min-h-11" onClick={() => void readiness.refetch()}>
                {t('shared.errorState.retry')}
              </Button>
            }
          >
            {t('ownerOnboarding.updateFailed')}
          </Alert>
        ) : null}

        <Outcomes report={report} activated={activated} />

        {report.truncated ? (
          <Alert variant="info" data-testid="owner-onboarding-truncated">
            {t('ownerOnboarding.truncated')}
          </Alert>
        ) : null}

        <ol role="list" className="space-y-4" data-testid="owner-phases">
          {OWNER_PHASES.map((phase, index) => (
            <Phase key={phase} phase={phase} index={index} state={states[phase]} highlighted={focus === phase}>
              {phase === 'owners' ? (
                <>
                  <p className="text-sm" data-testid="owner-owners-count">
                    {t('ownerOnboarding.counts.owners', { count: report.summary.owners, toComplete: report.summary.registry.toComplete })}
                  </p>
                  <OwnerImportPanel />
                  <OwnerReadinessTable
                    owners={report.owners}
                    dimensions={['registry']}
                    properties={report.properties}
                    allReadyLabel={t('ownerOnboarding.table.registryAllReady')}
                    testId="owner-registry-table"
                  />
                </>
              ) : null}
              {phase === 'shares' ? (
                <>
                  <PropertyShareList properties={report.properties} allReadyLabel={t('ownerOnboarding.table.sharesAllReady')} testId="owner-shares-list" />
                  <OwnerReadinessTable
                    owners={report.owners}
                    dimensions={['ownership', 'mandate']}
                    properties={report.properties}
                    allReadyLabel={t('ownerOnboarding.table.mandateAllReady')}
                    testId="owner-mandate-table"
                  />
                </>
              ) : null}
              {phase === 'accounting' ? (
                <OwnerReadinessTable
                  owners={report.owners}
                  dimensions={['fiscalProfile', 'payment']}
                  properties={report.properties}
                  canComplete
                  allReadyLabel={t('ownerOnboarding.table.accountingAllReady')}
                  testId="owner-accounting-table"
                />
              ) : null}
              {phase === 'portal' ? <OwnerInvitationPanel report={report} /> : null}
            </Phase>
          ))}
        </ol>
      </>
    );
  }

  return (
    <AppShell>
      <div className={cn(FOCUS_COLUMN, 'max-w-5xl space-y-6')} data-testid="owner-onboarding-page">
        <PageHeader
          title={t('ownerOnboarding.title')}
          description={t('ownerOnboarding.description')}
          action={
            <Button asChild variant="ghost" className={TOUCH_TARGET}>
              <Link to={ONBOARDING_PLAN_PATH} data-testid="owner-onboarding-back">
                {t('ownerOnboarding.backToPlan')}
              </Link>
            </Button>
          }
        />
        {content}
      </div>
    </AppShell>
  );
}
