import { useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/page-header';
import { FOCUS_COLUMN } from '@/components/layout/page-columns';
import { WizardShell, type WizardStep } from '@/components/shared/wizard/wizard-shell';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { PROPERTIES_PATH } from '@/features/properties/properties-paths';
import { PANEL_STEP_PATH, isStepId } from '@/lib/onboarding-panel';
import { cn } from '@/lib/utils';
import { useContinueExistingInventory, useSetInventoryIntents } from '@/queries/use-existing-inventory-import';
import {
  fetchFoundListings,
  useConfirmMapping,
  useFoundListings,
  useImportListing,
  useRejectMapping,
  useSetMappingRoom,
} from '@/queries/use-octorate-mapping';
import { octorateApi } from '@/api/octorate.api';
import { ChannelsFoundStep } from './channels-found-step';
import { ConnectDone } from './connect-done';
import { ConnectSummaryStep } from './connect-summary-step';
import { ConsentStep } from './consent-step';
import { ExistingChannelsStep } from './existing-channels-step';
import { ExistingImportProgressStep } from './existing-import-progress-step';
import { isAccessGiven, isAtMapping } from './existing-inventory';
import { InventoryScenarioStep } from './inventory-scenario-step';
import {
  CONNECT_WIZARD_DEFAULTS,
  MIXED_GROUP_NAMES,
  MIXED_STEP_SCHEMA,
  SCENARIO_STEP_SCHEMA,
  assignmentsOf,
  isWizardScenario,
  readGroups,
  routeForScenario,
  scenariosOfGroups,
  type ConnectWizardValues,
  type WizardScenario,
} from './inventory-scenario';
import { MappingStep } from './mapping-step';
import { MixedPortfolioStep } from './mixed-portfolio-step';
import {
  CHANNELS_STEP_ID,
  MAPPING_STEP_ID,
  MAPPING_STEP_SCHEMA,
  MappingIncompleteError,
  SUMMARY_STEP_ID,
  buildMappingPlan,
  decisionsAreReadable,
  mergeOutcomes,
  readDecisions,
  runMappingPlan,
  settleOutcomes,
  type ListingOutcome,
  type MappingProgress,
  type MappingRunner,
} from './mapping-model';
import { CONSENT_STEP_ID } from './octorate-callback';
import { useOctorateConnect } from './use-octorate-connect';
import { WhyConnectStep } from './why-connect-step';

/** Name of the flow: the draft (the answer to the first question, the step, the channels, the import and the decisions about the listings) lives under it. */
const WIZARD_ID = 'octorate-connect';

const SCENARIO_STEP_ID = 'scenario';
const WHY_STEP_ID = 'why';
const MIXED_STEP_ID = 'mixed';
const EXISTING_CHANNELS_STEP_ID = 'existing-channels';
const EXISTING_IMPORT_STEP_ID = 'existing-import';
const NEW_STEP_ID = 'new';

/** The draft of the wizard on the server (ADR-024): the answer, the channels and the import are found again on any device. */
const DRAFT_SERVER = { type: 'OnboardingActivation' } as const;

/** What the last button hands to the confirmation: what it did, listing by listing. */
interface WizardResult {
  outcomes: ListingOutcome[];
}

/** What stops the host on a step, said in the words of the step (the shell shows the message of an error that has none of its own). */
type Failing = 'consent' | 'mapping' | 'access' | 'import' | 'scenario';

/** A condition of a step that is not met: the host is told which, by the step's own words. */
class StepBlockedError extends Error {}

/**
 * "Salva ed esci" (NF-06): leaves the wizard from any step. What was answered is kept as the draft of the wizard (the shell writes it as
 * the page goes away), and the connection itself is the server's: a consent given stays given.
 */
function SaveAndExit({ onLeave }: { onLeave: () => void }) {
  const { t } = useTranslation();

  return (
    <div className="flex justify-end">
      <Button type="button" variant="ghost" size="sm" onClick={onLeave} data-testid="octorate-connect-save-exit">
        {t('octorate.connect.exit.saveAndExit')}
      </Button>
    </div>
  );
}

/** The road «new»: the only one that creates. It leads to the listing wizard, in place of this step, and never from any other road. */
function NewInventoryStep() {
  const route = routeForScenario('newInventory');
  return route.path ? <Navigate to={route.path} replace /> : null;
}

/** The answer asked for in the address (`?scenario=`), from the plan of the activation: it is the answer, and the question is not asked again. */
function requestedScenario(params: URLSearchParams): WizardScenario | null {
  const value = params.get('scenario');
  return isWizardScenario(value) ? value : null;
}

/** The first step after the question, for an answer that came with the address. */
function stepAfterQuestion(scenario: WizardScenario): string {
  return scenario === 'mixed' ? MIXED_STEP_ID : WHY_STEP_ID;
}

/**
 * «Collega i tuoi canali» (E02/F01/US01/T04, E02/F01/US03/T02, ADR-023): the guided connection of the inventory to the channel manager, a
 * `WizardShell` like the other wizards, with one road for each answer to «Dove si trovano oggi i tuoi annunci?»:
 *
 * - `onOctorate`: the consent of the channel manager (same tab, back to the same step), the listings and channels found, which CasaZen property
 *   each listing is, the summary;
 * - `onOtas`: the same consent, then the OTAs the host uses, the access to each one given on the panel of the channel manager (a handoff CasaZen
 *   owns: the step is stored first, the panel opens in a controlled window, the result is read and the wizard goes on by itself), the import with
 *   its durable progress, the mapping and the summary. Nothing is created or published on any of these roads;
 * - `newInventory`: the listing wizard, the only road that creates, reached only from this answer;
 * - `mixed`: each property says which situation it is in, and each situation follows its own road in the same wizard.
 *
 * The answer, the channels, the import and the decisions are the draft of the wizard, kept on the server too, so a reload, «Indietro», «Salva ed
 * esci», the return from the panel and another device resume the same step. Every step has «Salva ed esci».
 */
function ConnectWizard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const connect = useOctorateConnect();
  const confirmMapping = useConfirmMapping();
  const importListing = useImportListing();
  const rejectMapping = useRejectMapping();
  const setRoom = useSetMappingRoom();
  const continueImport = useContinueExistingInventory();
  const setIntents = useSetInventoryIntents();
  const asked = requestedScenario(searchParams);

  const connected = connect.phase === 'connected';
  // The listings the channel manager holds that a person has matched: with an import started, they make a change to «new» impossible.
  const listings = useFoundListings({ enabled: connected });
  const mappingExists = (listings.data ?? []).some((listing) => listing.status !== 'Rejected');

  // A run can stop halfway: a listing the channel manager refuses does not stop the others, and the next run does what is left. The
  // summary shows how far the run is and which listings did not go through.
  const [progress, setProgress] = useState<MappingProgress | null>(null);
  const [outcomes, setOutcomes] = useState<ListingOutcome[]>([]);
  // The buttons that can fail with no message of their own: which one, to say it right.
  const [failing, setFailing] = useState<Failing>('consent');

  const retry = connect.phase === 'attention' || connect.phase === 'denied' || connect.phase === 'failed';
  const working = connect.phase === 'checking' || connect.phase === 'completing';

  const startConsent = async () => {
    setFailing('consent');
    await connect.start();
  };

  const runner: MappingRunner = {
    confirm: (listingId, propertyId, roomId) => confirmMapping.mutateAsync({ listingId, propertyId, roomId }),
    importListing: (listingId) => importListing.mutateAsync(listingId),
    reject: (listingId) => rejectMapping.mutateAsync(listingId),
    setRoom: (listingId, roomId) => setRoom.mutateAsync({ listingId, roomId }),
  };

  /**
   * The last button: what the host decided, done. The listings are read again first, so that a listing confirmed meanwhile (another tab,
   * another person) is not confirmed twice. Some listings may not go through: the run then ends in an error that keeps the host on the
   * summary, which says which and why, and the ones that went through are done for good. On the road of the existing listings the import
   * then goes on for the confirmed ones: reservations, calendars and the link; the ones left for later stay write-blocked.
   */
  const applyMapping = async (values: ConnectWizardValues): Promise<WizardResult> => {
    setFailing('mapping');
    const found = await fetchFoundListings(queryClient);
    const plan = buildMappingPlan(found, readDecisions(values.decisions));
    if (plan.actions.length > 0) setProgress({ done: 0, total: plan.actions.length });

    try {
      const done = await runMappingPlan(plan.actions, runner, (finished, total) => setProgress({ done: finished, total }));
      // The listings as they stand now, before the summary or the result reads them: no listing shows as it was before the run.
      if (done.length > 0) await fetchFoundListings(queryClient);
      // A failure of an earlier run stands only while its listing has something to do again: one left for later since, or done
      // somewhere else, is not reported as failed in the result.
      const all = mergeOutcomes(settleOutcomes(outcomes, plan), done);
      setOutcomes(all);
      const failed = done.filter((outcome) => outcome.kind === 'failed').length;
      if (failed > 0) throw new MappingIncompleteError(failed);
      if (values.batchId) {
        await continueImport.mutateAsync({ batchId: values.batchId, leaveForLater: plan.later.map((listing) => listing.octorateAccommodationId) });
      }
      return { outcomes: all };
    } finally {
      setProgress(null);
    }
  };

  /** The steps the answers give now: the question, then the road of the answer (and, for a mixed portfolio, the roads of its situations). */
  const stepsFor = (values: ConnectWizardValues): WizardStep<ConnectWizardValues>[] => {
    const scenario = values.scenario;
    const situations = scenario === 'mixed' ? scenariosOfGroups(readGroups(values.groups)) : null;
    // With no answer yet (an address typed by hand, a draft that was dropped) the consent is what this wizard is for: the first road.
    const onOctorate = scenario === null || scenario === 'onOctorate' || situations?.has('onOctorate') === true;
    const onOtas = scenario === 'onOtas' || situations?.has('onOtas') === true;
    const creates = scenario === 'newInventory' || (situations !== null && !onOctorate && !onOtas && situations.has('newInventory'));
    const group = scenario === 'mixed' ? MIXED_GROUP_NAMES.onOtas : undefined;

    const questionStep: WizardStep<ConnectWizardValues> = {
      id: SCENARIO_STEP_ID,
      label: t('octorate.connect.steps.scenario.label'),
      title: t('octorate.connect.steps.scenario.title'),
      purpose: t('octorate.connect.steps.scenario.purpose'),
      schema: SCENARIO_STEP_SCHEMA,
      // A change to «new» is refused once listings were matched, whatever the draft says: the server refuses it for a property too.
      beforeNext: (answers) => {
        if (answers.scenario === 'newInventory' && mappingExists && answers.committedScenario && answers.committedScenario !== 'newInventory') {
          setFailing('scenario');
          throw new StepBlockedError('The answer cannot become «new» once listings were matched');
        }
      },
      render: () => <InventoryScenarioStep mappingExists={mappingExists} />,
    };
    const whyStep: WizardStep<ConnectWizardValues> = {
      id: WHY_STEP_ID,
      label: t('octorate.connect.whyConnect'),
      title: t('octorate.connect.whyConnect'),
      purpose: t('octorate.connect.steps.why.purpose'),
      render: () => <WhyConnectStep />,
    };
    const mixedStep: WizardStep<ConnectWizardValues> = {
      id: MIXED_STEP_ID,
      label: t('octorate.connect.steps.mixed.label'),
      title: t('octorate.connect.steps.mixed.title'),
      purpose: t('octorate.connect.steps.mixed.purpose'),
      schema: MIXED_STEP_SCHEMA,
      // Each situation is declared, property by property: the server keeps it and refuses a property that cannot become «new».
      beforeNext: async (answers) => {
        await setIntents.mutateAsync(assignmentsOf(readGroups(answers.groups)));
      },
      render: () => <MixedPortfolioStep lockedNew={mappingExists} />,
    };
    const consentStep: WizardStep<ConnectWizardValues> = {
      id: CONSENT_STEP_ID,
      label: t('octorate.connect.steps.consent.label'),
      title: t('octorate.connect.steps.consent.title'),
      purpose: t('octorate.connect.steps.consent.purpose'),
      // The main button sends the host to the channel manager, or, once the connection works, to what comes next. It waits while the state is
      // read or the code is exchanged, and has nothing to start once the connection works.
      nextLabel: t(
        connected ? (onOctorate ? 'octorate.connect.consent.next.listings' : 'octorate.connect.consent.next.channels') : retry ? 'octorate.connect.consent.next.retry' : 'octorate.connect.consent.next.start',
      ),
      beforeNext: connected ? undefined : startConsent,
      nextDisabled: working,
      render: () => <ConsentStep connect={connect} />,
    };
    const foundStep: WizardStep<ConnectWizardValues> = {
      id: CHANNELS_STEP_ID,
      label: t('octorate.connect.steps.channels.label'),
      title: t('octorate.connect.steps.channels.title'),
      purpose: t('octorate.connect.steps.channels.purpose'),
      render: ({ goTo }) => <ChannelsFoundStep phase={connect.phase} onBackToConsent={() => goTo(CONSENT_STEP_ID)} />,
    };
    const existingChannelsStep: WizardStep<ConnectWizardValues> = {
      id: EXISTING_CHANNELS_STEP_ID,
      label: t('octorate.connect.steps.existingChannels.label'),
      title: t('octorate.connect.steps.existingChannels.title'),
      purpose: t('octorate.connect.steps.existingChannels.purpose'),
      nextLabel: t('octorate.connect.steps.existingChannels.next'),
      // The import goes on for the channels whose access CasaZen saw (or the host confirmed after a check that could not tell): at least one.
      beforeNext: async (answers) => {
        const batch = answers.batchId ? await octorateApi.getExistingInventoryBatch(answers.batchId) : undefined;
        if (!batch?.channels.some(isAccessGiven)) {
          setFailing('access');
          throw new StepBlockedError('No channel has its access yet');
        }
      },
      render: ({ goTo }) => <ExistingChannelsStep group={group} onAdvance={() => goTo(EXISTING_IMPORT_STEP_ID)} />,
    };
    const existingImportStep: WizardStep<ConnectWizardValues> = {
      id: EXISTING_IMPORT_STEP_ID,
      label: t('octorate.connect.steps.existingImport.label'),
      title: t('octorate.connect.steps.existingImport.title'),
      purpose: t('octorate.connect.steps.existingImport.purpose'),
      nextLabel: t('octorate.connect.steps.existingImport.next'),
      // The mapping opens only when the listings are in (the batch says it waits for the host): never before, and never on a guess.
      beforeNext: async (answers) => {
        const batch = answers.batchId ? await octorateApi.getExistingInventoryBatch(answers.batchId) : undefined;
        if (!isAtMapping(batch)) {
          setFailing('import');
          throw new StepBlockedError('The listings are not in yet');
        }
      },
      render: ({ goTo }) => <ExistingImportProgressStep onAdvance={() => goTo(MAPPING_STEP_ID)} />,
    };
    const mappingStep: WizardStep<ConnectWizardValues> = {
      id: MAPPING_STEP_ID,
      label: t('octorate.connect.steps.mapping.label'),
      title: t('octorate.connect.steps.mapping.title'),
      purpose: t('octorate.connect.steps.mapping.purpose'),
      schema: MAPPING_STEP_SCHEMA,
      render: () => (
        <div className="space-y-4">
          {onOtas ? (
            <Alert variant="info" data-testid="octorate-mapping-existing-note">
              {t('octorate.connect.existing.mapping.note')}
            </Alert>
          ) : null}
          <MappingStep />
        </div>
      ),
    };
    const summaryStep: WizardStep<ConnectWizardValues> = {
      id: SUMMARY_STEP_ID,
      label: t('octorate.connect.steps.summary.label'),
      title: t('octorate.connect.steps.summary.title'),
      purpose: t('octorate.connect.steps.summary.purpose'),
      // The last button concludes the whole path and reads the channel manager: it waits for a connection that works (a draft taken up
      // again after a disconnection, or the address of this step, must not end in "Collegamento completato" with nothing connected).
      nextDisabled: !connected,
      render: ({ goTo }) => (
        <ConnectSummaryStep
          progress={progress}
          failures={outcomes.filter((outcome) => outcome.kind === 'failed')}
          phase={connect.phase}
          existing={onOtas}
          onBackToConsent={() => goTo(CONSENT_STEP_ID)}
        />
      ),
    };
    const newStep: WizardStep<ConnectWizardValues> = {
      id: NEW_STEP_ID,
      label: t('octorate.connect.steps.new.label'),
      title: t('octorate.connect.steps.new.title'),
      purpose: t('octorate.connect.steps.new.purpose'),
      render: () => <NewInventoryStep />,
    };

    const steps = [questionStep, scenario === 'mixed' ? mixedStep : whyStep];
    if (onOctorate || onOtas) steps.push(consentStep);
    if (onOctorate) steps.push(foundStep);
    if (onOtas) steps.push(existingChannelsStep, existingImportStep);
    if (onOctorate || onOtas) steps.push(mappingStep, summaryStep);
    if (creates) steps.push(newStep);
    return steps;
  };

  const failedMessage = {
    consent: t('octorate.connect.finishFailed'),
    mapping: t('octorate.connect.summary.failed.generic'),
    access: t('octorate.connect.existing.errors.accessPending'),
    import: t('octorate.connect.existing.errors.notInYet'),
    scenario: t('octorate.connect.errors.scenarioChangeRefused'),
  }[failing];

  return (
    <WizardShell<ConnectWizardValues, WizardResult>
      id={WIZARD_ID}
      steps={stepsFor(CONNECT_WIZARD_DEFAULTS)}
      stepsFor={stepsFor}
      // Back from the channel manager the answer to the first question is whatever the draft remembers (the consent belongs to three roads),
      // and without a draft it is the first road: only the consent leads there. The address names no step: the host comes back to where they
      // left, the consent. An answer asked for in the address is the answer: the question is not asked again.
      defaultValues={{ ...CONNECT_WIZARD_DEFAULTS, scenario: connect.returned ? 'onOctorate' : asked }}
      initialStepId={connect.returned ? CONSENT_STEP_ID : asked ? stepAfterQuestion(asked) : undefined}
      // A draft that says otherwise (the host left another way and came back later) does not take the answer away from the consent. A
      // draft whose decisions are not a list of decisions (it is just data in the tab) is not used.
      draft={{
        accept: (saved) =>
          (!connect.returned || saved.values.scenario === 'onOctorate' || saved.values.scenario === 'onOtas' || saved.values.scenario === 'mixed') &&
          decisionsAreReadable(saved.values.decisions),
        server: DRAFT_SERVER,
      }}
      finishLabel={t('octorate.connect.finishLabel')}
      finishFailedMessage={failedMessage}
      onFinish={applyMapping}
      onExit={() => navigate(PROPERTIES_PATH)}
      aboveFooter={
        <SaveAndExit
          onLeave={() => {
            toast.success(t('octorate.connect.exit.saved'));
            navigate(PROPERTIES_PATH);
          }}
        />
      }
      renderDone={({ result, values }) => (
        <ConnectDone
          outcomes={result?.outcomes ?? null}
          fresh={result !== undefined}
          batchId={values.batchId ?? null}
          hasNew={values.scenario === 'mixed' && scenariosOfGroups(readGroups(values.groups)).has('newInventory')}
        />
      )}
      testIds={{
        root: 'octorate-connect-wizard',
        back: 'octorate-connect-back',
        next: 'octorate-connect-next',
        finish: 'octorate-connect-finish',
        exit: 'octorate-connect-exit',
        finishError: 'octorate-connect-finish-error',
      }}
    />
  );
}

/**
 * The wizard of the connection as a page: the callback of a guided step that sends the person back (`?step=<id>&state=<state>`, the registered
 * return address is this page) is forwarded to the page of the guided steps, which uses the state once. Anything else is the wizard.
 */
function ConnectOrPanelReturn() {
  const [searchParams] = useSearchParams();
  const stepId = searchParams.get('step');
  if (isStepId(stepId) && searchParams.get('state')) {
    return <Navigate to={`${PANEL_STEP_PATH}?step=${encodeURIComponent(stepId)}&state=${encodeURIComponent(searchParams.get('state') ?? '')}`} replace />;
  }
  return <ConnectWizard />;
}

/**
 * `/app/short-rent/integrations/octorate`: «Collega i tuoi canali». In no menu: the onboarding, the list of the properties and the
 * settings of the integrations lead here. It is also the page the channel manager sends the host back to after the consent (the
 * callback address registered with it), so a visit may open with a `code` and a `state` in the address; a guided step of the panel that sends
 * the person back comes with `step` and `state`, and goes on to its own page. `?scenario=onOctorate|onOtas|newInventory|mixed` is the answer
 * to the first question, from the plan of the activation.
 */
export function OctorateConnectWizardPage() {
  const { t } = useTranslation();

  return (
    <div className={cn(FOCUS_COLUMN, 'space-y-6')} data-testid="octorate-connect-page">
      <PageHeader
        title={t('octorate.connect.title')}
        description={t('octorate.connect.page.description')}
        crumbs={[{ label: t('nav.properties'), to: PROPERTIES_PATH }, { label: t('octorate.connect.title') }]}
      />
      <ConnectOrPanelReturn />
    </div>
  );
}
