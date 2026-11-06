import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useWatch, type UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/page-header';
import { FOCUS_COLUMN } from '@/components/layout/page-columns';
import { WizardShell, type WizardStep } from '@/components/shared/wizard/wizard-shell';
import { Button } from '@/components/ui/button';
import { PROPERTIES_PATH } from '@/features/properties/properties-paths';
import { cn } from '@/lib/utils';
import {
  fetchFoundListings,
  useConfirmMapping,
  useImportListing,
  useRejectMapping,
  useSetMappingRoom,
} from '@/queries/use-octorate-mapping';
import { ChannelsFoundStep } from './channels-found-step';
import { ConnectDone } from './connect-done';
import { ConnectSummaryStep } from './connect-summary-step';
import { ConsentStep } from './consent-step';
import { InventoryScenarioStep } from './inventory-scenario-step';
import { routeForScenario, SCENARIO_STEP_SCHEMA, type ConnectWizardValues } from './inventory-scenario';
import { MappingStep } from './mapping-step';
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
  type ListingOutcome,
  type MappingProgress,
  type MappingRunner,
} from './mapping-model';
import { CONSENT_STEP_ID } from './octorate-callback';
import { useOctorateConnect, type OctorateConnect } from './use-octorate-connect';
import { WhyConnectStep } from './why-connect-step';

/** Name of the flow: the draft (the answer to the first question, the step and the decisions about the listings) lives under it. */
const WIZARD_ID = 'octorate-connect';

const SCENARIO_STEP_ID = 'scenario';
const WHY_STEP_ID = 'why';

/** What the last button hands to the confirmation: what it did, listing by listing. */
interface WizardResult {
  outcomes: ListingOutcome[];
}

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

interface ConnectionStepProps {
  form: UseFormReturn<ConnectWizardValues>;
  connect: OctorateConnect;
}

/**
 * The third step, where the first answer takes the host: the consent of the channel manager (this wizard), or the listing wizard when
 * nothing is published yet. The import of the listings that exist is not built yet, so its answer cannot be given; one that comes from a
 * draft is sent back to the question. Back from the channel manager it is always the consent, whatever the draft remembers; with no
 * answer at all (an address typed by hand) the consent is what this wizard is for.
 */
function ConnectionStep({ form, connect }: ConnectionStepProps) {
  const scenario = useWatch({ control: form.control, name: 'scenario' });
  if (connect.returned || scenario === null) return <ConsentStep connect={connect} />;

  const route = routeForScenario(scenario);
  if (route.kind === 'listing' && route.path) return <Navigate to={route.path} replace />;
  if (route.kind !== 'consent') return <Navigate to={{ search: `?step=${SCENARIO_STEP_ID}` }} replace />;
  return <ConsentStep connect={connect} />;
}

/**
 * "Collega i tuoi canali" (E02/F01/US01/T04, ADR-023): the guided connection of the inventory to the channel manager, a `WizardShell`
 * like the other wizards. The first question says where the listings are today; the next screen says why connecting is worth it; the
 * third sends the host to the channel manager to give the consent, in the same tab, and the page the host comes back to is this one.
 *
 * The consent is followed by three steps of the same wizard (E02/F01/US02/T05): the listings and channels found, which CasaZen property
 * each listing is, and the summary. The host decides in the second of them and nothing is sent until the last button, which does it listing
 * by listing and ends in the result for each one. Every step has "Salva ed esci".
 */
function ConnectWizard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const connect = useOctorateConnect();
  const confirmMapping = useConfirmMapping();
  const importListing = useImportListing();
  const rejectMapping = useRejectMapping();
  const setRoom = useSetMappingRoom();

  // A run can stop halfway: a listing the channel manager refuses does not stop the others, and the next run does what is left. The
  // summary shows how far the run is and which listings did not go through.
  const [progress, setProgress] = useState<MappingProgress | null>(null);
  const [outcomes, setOutcomes] = useState<ListingOutcome[]>([]);
  // The two buttons that can fail with no message of their own (the page of the consent, the listings): which one, to say it right.
  const [failing, setFailing] = useState<'consent' | 'mapping'>('consent');

  const connected = connect.phase === 'connected';
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
   * summary, which says which and why, and the ones that went through are done for good.
   */
  const applyMapping = async (values: ConnectWizardValues): Promise<WizardResult> => {
    setFailing('mapping');
    const listings = await fetchFoundListings(queryClient);
    const plan = buildMappingPlan(listings, readDecisions(values.decisions));
    if (plan.actions.length > 0) setProgress({ done: 0, total: plan.actions.length });

    try {
      const done = await runMappingPlan(plan.actions, runner, (finished, total) => setProgress({ done: finished, total }));
      // The listings as they stand now, before the summary or the result reads them: no listing shows as it was before the run.
      if (done.length > 0) await fetchFoundListings(queryClient);
      const all = mergeOutcomes(outcomes, done);
      setOutcomes(all);
      const failed = done.filter((outcome) => outcome.kind === 'failed').length;
      if (failed > 0) throw new MappingIncompleteError(failed);
      return { outcomes: all };
    } finally {
      setProgress(null);
    }
  };

  const steps: WizardStep<ConnectWizardValues>[] = [
    {
      id: SCENARIO_STEP_ID,
      label: t('octorate.connect.steps.scenario.label'),
      title: t('octorate.connect.steps.scenario.title'),
      purpose: t('octorate.connect.steps.scenario.purpose'),
      schema: SCENARIO_STEP_SCHEMA,
      render: () => <InventoryScenarioStep />,
    },
    {
      id: WHY_STEP_ID,
      label: t('octorate.connect.whyConnect'),
      title: t('octorate.connect.whyConnect'),
      purpose: t('octorate.connect.steps.why.purpose'),
      render: () => <WhyConnectStep />,
    },
    {
      id: CONSENT_STEP_ID,
      label: t('octorate.connect.steps.consent.label'),
      title: t('octorate.connect.steps.consent.title'),
      purpose: t('octorate.connect.steps.consent.purpose'),
      // The main button sends the host to the channel manager, or, once the connection works, to the listings found. It waits while the
      // state is read or the code is exchanged, and has nothing to start once the connection works.
      nextLabel: t(
        connected ? 'octorate.connect.consent.next.listings' : retry ? 'octorate.connect.consent.next.retry' : 'octorate.connect.consent.next.start',
      ),
      beforeNext: connected ? undefined : startConsent,
      nextDisabled: working,
      render: ({ form }) => <ConnectionStep form={form} connect={connect} />,
    },
    {
      id: CHANNELS_STEP_ID,
      label: t('octorate.connect.steps.channels.label'),
      title: t('octorate.connect.steps.channels.title'),
      purpose: t('octorate.connect.steps.channels.purpose'),
      render: ({ goTo }) => <ChannelsFoundStep phase={connect.phase} onBackToConsent={() => goTo(CONSENT_STEP_ID)} />,
    },
    {
      id: MAPPING_STEP_ID,
      label: t('octorate.connect.steps.mapping.label'),
      title: t('octorate.connect.steps.mapping.title'),
      purpose: t('octorate.connect.steps.mapping.purpose'),
      schema: MAPPING_STEP_SCHEMA,
      render: () => <MappingStep />,
    },
    {
      id: SUMMARY_STEP_ID,
      label: t('octorate.connect.steps.summary.label'),
      title: t('octorate.connect.steps.summary.title'),
      purpose: t('octorate.connect.steps.summary.purpose'),
      render: () => <ConnectSummaryStep progress={progress} failures={outcomes.filter((outcome) => outcome.kind === 'failed')} />,
    },
  ];

  return (
    <WizardShell<ConnectWizardValues, WizardResult>
      id={WIZARD_ID}
      steps={steps}
      // Back from the channel manager the answer to the first question is known whatever the draft remembers: only the consent leads
      // there. The address names no step: the host comes back to where they left, the consent.
      defaultValues={{ scenario: connect.returned ? 'onOctorate' : null, decisions: [] }}
      initialStepId={connect.returned ? CONSENT_STEP_ID : undefined}
      // A draft that says otherwise (the host left another way and came back later) does not take the answer away from the consent. A
      // draft whose decisions are not a list of decisions (it is just data in the tab) is not used.
      draft={{
        accept: (saved) => (!connect.returned || saved.values.scenario === 'onOctorate') && decisionsAreReadable(saved.values.decisions),
      }}
      finishLabel={t('octorate.connect.finishLabel')}
      finishFailedMessage={t(failing === 'mapping' ? 'octorate.connect.summary.failed.generic' : 'octorate.connect.finishFailed')}
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
      renderDone={({ result }) => <ConnectDone outcomes={result?.outcomes ?? null} fresh={result !== undefined} />}
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
 * `/app/short-rent/integrations/octorate`: «Collega i tuoi canali». In no menu: the onboarding, the list of the properties and the
 * settings of the integrations lead here. It is also the page the channel manager sends the host back to after the consent (the
 * callback address registered with it), so a visit may open with a `code` and a `state` in the address.
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
      <ConnectWizard />
    </div>
  );
}
