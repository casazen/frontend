import { useCallback, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Store } from 'lucide-react';
import { z, type ZodType } from 'zod';
import type { FieldValues } from 'react-hook-form';
import { EmptyState } from '@/components/shared/empty-state';
import { WizardShell, type WizardStep } from '@/components/shared/wizard/wizard-shell';
import { useFeatureFlags } from '@/hooks/use-feature-flags';
import { useWorkspace } from '@/hooks/use-workspace';
import { findPanelStep, isPanelStepDone } from '@/lib/onboarding-panel';
import { isOrgBillingAdmin } from '@/lib/org-billing-admin';
import {
  cachedActivation,
  fetchActivationMapping,
  fetchActivationPlan,
  useActivate,
  useActivationPlans,
  useSaveActivationMapping,
} from '@/queries/use-marketplace';
import { usePanelSteps } from '@/queries/use-onboarding-panel-step';
import { useProperties } from '@/queries/use-properties';
import type { MarketplaceActivationPlan, MarketplaceConnectionKind } from '@/types';
import { SaveAndExit, WizardFrame } from '../components/wizard-frame';
import { parseMarketplaceEntry } from '../lib/marketplace-entry';
import { MARKETPLACE_PATH, MARKETPLACE_PROPERTY_PARAM } from '../lib/marketplace-paths';
import { useWizardLeave, useWizardReturn } from '../lib/use-wizard-exit';
import {
  ACTIVATION_DRAFT_VERSION,
  ACTIVATION_STEP,
  ACTIVATION_WIZARD_DEFAULTS,
  NO_CREDENTIALS,
  activationStepIds,
  activationWizardId,
  connectionKindOfSlug,
  isAccessComplete,
  mappingProblem,
  missingAccess,
  outcomeOfFailure,
  outcomeOfState,
  problemCodeOf,
  requirementsOf,
  roomChoices,
  roomChoicesToSave,
  type ActivationContext,
  type ActivationOutcome,
  type ActivationStepId,
  type ActivationWizardValues,
  type PortalCredentials,
} from './activation-wizard-model';
import { AccessStep, type PanelAccess, type PanelAvailability } from './steps/access-step';
import { ActivateStep } from './steps/activate-step';
import { ConnectionStep } from './steps/connection-step';
import { ImportStep } from './steps/import-step';
import { MappingStep } from './steps/mapping-step';
import { PropertyStep } from './steps/property-step';
import { ResultStep } from './steps/result-step';

type StepSchema = ZodType<unknown, FieldValues>;

/** At least one property: the first step does not advance without. The message is an i18n key, as in every form. */
const PROPERTY_STEP_SCHEMA: StepSchema = z.object({
  propertyIds: z.array(z.string()).min(1, 'marketplace.activation.errors.noProperty'),
});

/** The short-rent properties of the host, in the order the app lists them: what a channel manager listing can be linked to. */
const SHORT_RENT = { mode: 'short' } as const;

/** What stops a step on a condition that is not met: the host is told which, by the words of the step (the shell shows the message of an error that has none of its own). */
class StepBlockedError extends Error {}

/** The steps that can fail with no message of their own: which one, to say it right. */
type Failing = 'property' | 'access' | 'connection' | 'import' | 'mappingNone' | 'mappingUndecided' | 'mappingSave';

/** What the last button hands to the result: how each property ended. */
interface ActivationResult {
  outcomes: ActivationOutcome[];
}

/**
 * The wizard of a channel or a tool (E09/F02/US04): a `WizardShell` whose steps follow what the portal asks of the person. The steps, the plan that
 * says what the portal needs and the properties are read here and handed to the steps, which read nothing the page has read already.
 */
function ActivationWizard({ kind, code }: { kind: MarketplaceConnectionKind; code: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const { exitPath } = useWizardReturn();
  const leave = useWizardLeave(exitPath, t('marketplace.activation.exit.saved'));
  const { contexts } = useWorkspace();
  const { flags } = useFeatureFlags();
  const saveMapping = useSaveActivationMapping();
  const activate = useActivate();

  // The access data of the portal lives here and nowhere else: not in the values of the wizard, so never in its draft or in the storage of the browser.
  const [credentials, setCredentials] = useState<PortalCredentials>(NO_CREDENTIALS);
  const forgetCredentials = useCallback(() => setCredentials(NO_CREDENTIALS), []);
  const [showAccessErrors, setShowAccessErrors] = useState(false);
  // What the person changed in the mapping of the rooms, by property and room of the channel: the rest is what the server proposes.
  const [overrides, setOverrides] = useState<Record<string, Record<string, string>>>({});
  const [showMappingErrors, setShowMappingErrors] = useState(false);
  const [failing, setFailing] = useState<Failing>('property');
  // «Correggi» on the result opens the wizard again at the step that failed: a new shell, with the property that failed chosen.
  const [attempt, setAttempt] = useState(0);
  const [restart, setRestart] = useState<ActivationWizardValues | null>(null);

  const propertiesQuery = useProperties(SHORT_RENT);
  const properties = useMemo(() => propertiesQuery.data ?? [], [propertiesQuery.data]);
  const propertyIds = useMemo(() => properties.map((property) => property.id), [properties]);
  const planQueries = useActivationPlans(kind, code, propertyIds);
  const plans = useMemo(() => {
    const read = new Map<string, MarketplaceActivationPlan>();
    planQueries.forEach((query, index) => {
      if (query.data) read.set(propertyIds[index], query.data);
    });
    return read;
  }, [planQueries, propertyIds]);

  const firstPlan = plans.values().next().value;
  const requirements = firstPlan ? requirementsOf(firstPlan.requirements) : null;
  const channelName = firstPlan?.name ?? null;
  const planError = plans.size === 0 ? (planQueries.find((query) => query.isError)?.error ?? null) : null;

  const context: ActivationContext = {
    kind,
    code,
    channelName,
    requirements,
    properties,
    propertiesStatus: propertiesQuery.isPending ? 'pending' : propertiesQuery.isError ? 'error' : 'ready',
    plans,
    plansPending: planQueries.some((query) => query.isPending),
    planError,
    onRetry: () => {
      void propertiesQuery.refetch();
      planQueries.forEach((query) => void query.refetch());
    },
  };

  // The access on the panel of the channel manager is the organization administrator's, and the guided steps of the activation are behind their flag.
  const panelAvailability: PanelAvailability = !flags.octorateOnboarding ? 'unavailable' : isOrgBillingAdmin(contexts) ? 'ready' : 'notAdmin';
  const needsPanel = requirements?.panelAccess === true;
  const panelSteps = usePanelSteps(undefined, { enabled: needsPanel && panelAvailability === 'ready' });
  const panel: PanelAccess = { availability: panelAvailability, steps: panelSteps.data };
  const panelDone = (propertyId: string) => isPanelStepDone(findPanelStep(panelSteps.data, { kind: 'channelAccess', propertyId, channelCode: code }));

  const requestedPropertyId = searchParams.get(MARKETPLACE_PROPERTY_PARAM);
  const name = channelName ?? t('marketplace.activation.thisChannel');
  const activationIdOf = (propertyId: string) => plans.get(propertyId)?.activationId ?? null;
  /** The activation of a property for a button that acts on it: from the plan read, or from a new read, so that a plan not read yet is never taken for «no activation». */
  const resolveActivationId = async (propertyId: string): Promise<string | null> =>
    activationIdOf(propertyId) ?? (await fetchActivationPlan(queryClient, kind, code, propertyId)).activationId;

  /** «Correggi» of the result: the wizard opens again at `step` with the property that failed, keeping where the person came from. */
  const reopenAt = (propertyId: string, step: ActivationStepId, values: ActivationWizardValues) => {
    setRestart({ propertyIds: [propertyId], hotelIds: values.hotelIds });
    setShowAccessErrors(false);
    setShowMappingErrors(false);
    setAttempt((current) => current + 1);
    const next = new URLSearchParams(searchParams);
    next.set('step', step);
    next.set(MARKETPLACE_PROPERTY_PARAM, propertyId);
    navigate({ search: `?${next.toString()}` }, { replace: true });
  };

  /**
   * The last button: each chosen property is activated in its turn (`POST .../activate`), and the result tells each one. A property the server refuses, or that the
   * channel manager does not show working, is To fix with its reason and does not stop the others; Active is only what the server says is Active.
   */
  const activateAll = async (values: ActivationWizardValues): Promise<ActivationResult> => {
    const outcomes: ActivationOutcome[] = [];
    for (const propertyId of values.propertyIds) {
      try {
        const activationId = await resolveActivationId(propertyId);
        outcomes.push(activationId ? outcomeOfState(propertyId, await activate.mutateAsync(activationId)) : outcomeOfFailure(propertyId, 'marketplace_connection_missing'));
      } catch (error) {
        outcomes.push(outcomeOfFailure(propertyId, problemCodeOf(error)));
      }
    }
    return { outcomes };
  };

  /** The steps the answers give now: the properties, the access when the portal asks for something, and the steps of the activation itself. */
  const stepsFor = (values: ActivationWizardValues): WizardStep<ActivationWizardValues>[] => {
    const propertyStep: WizardStep<ActivationWizardValues> = {
      id: ACTIVATION_STEP.property,
      label: t('marketplace.activation.steps.property.label'),
      title: t('marketplace.activation.steps.property.title'),
      purpose: t('marketplace.activation.steps.property.purpose', { name }),
      schema: PROPERTY_STEP_SCHEMA,
      // The chosen properties are the ones whose plan says they are linked: a draft or an address that names another one is not a way round the plan.
      beforeNext: (answers) => {
        if (!answers.propertyIds.every((propertyId) => plans.get(propertyId)?.propertyLinked === true)) {
          setFailing('property');
          throw new StepBlockedError('A property that is not linked to the channel manager cannot be chosen');
        }
      },
      nextDisabled: context.planError !== null || [...plans.values()].some((plan) => !plan.creatable),
      render: () => <PropertyStep context={context} />,
    };

    const accessStep: WizardStep<ActivationWizardValues> = {
      id: ACTIVATION_STEP.access,
      label: t('marketplace.activation.steps.access.label'),
      title: t('marketplace.activation.steps.access.title', { name }),
      purpose: t('marketplace.activation.steps.access.purpose'),
      // The access on the panel is done by the person there and seen by CasaZen: until every chosen property has it, the wizard waits.
      nextDisabled: needsPanel && (panelAvailability !== 'ready' || !values.propertyIds.every(panelDone)),
      beforeNext: (answers) => {
        const missing = missingAccess(requirements ?? requirementsOf([]), answers.propertyIds, answers.hotelIds, credentials);
        if (!isAccessComplete(missing)) {
          setShowAccessErrors(true);
          setFailing('access');
          throw new StepBlockedError('The access data the portal asks for is not complete');
        }
      },
      render: ({ goTo }) => (
        <AccessStep
          context={context}
          credentials={credentials}
          onCredentialsChange={setCredentials}
          showErrors={showAccessErrors}
          panel={panel}
          onSaveAndExit={leave}
          onChoose={() => goTo(ACTIVATION_STEP.property)}
        />
      ),
    };

    const connectionStep: WizardStep<ActivationWizardValues> = {
      id: ACTIVATION_STEP.connection,
      label: t('marketplace.activation.steps.connection.label'),
      title: t('marketplace.activation.steps.connection.title', { name }),
      purpose: t('marketplace.activation.steps.connection.purpose'),
      // The import starts only when every chosen property has its connection on the channel manager: the state the steps of this wizard gave says it.
      beforeNext: (answers) => {
        if (!answers.propertyIds.every((propertyId) => cachedActivation(queryClient, activationIdOf(propertyId))?.connectionFound === true)) {
          setFailing('connection');
          throw new StepBlockedError('Not every chosen property is connected yet');
        }
      },
      render: ({ goTo }) => (
        <ConnectionStep
          context={context}
          credentials={credentials}
          onCredentialsUsed={forgetCredentials}
          onFix={goTo}
          onAdvance={() => goTo(ACTIVATION_STEP.import)}
          onChoose={() => goTo(ACTIVATION_STEP.property)}
        />
      ),
    };

    const importStep: WizardStep<ActivationWizardValues> = {
      id: ACTIVATION_STEP.import,
      label: t('marketplace.activation.steps.import.label'),
      title: t('marketplace.activation.steps.import.title'),
      purpose: t('marketplace.activation.steps.import.purpose'),
      // The mapping opens only when the rooms of every property are in (the mapping read gives them): never before, and never on a guess.
      beforeNext: async (answers) => {
        setFailing('import');
        for (const propertyId of answers.propertyIds) {
          const activationId = await resolveActivationId(propertyId);
          const mapping = activationId ? await fetchActivationMapping(queryClient, activationId, { fresh: true }) : null;
          if (!mapping || mapping.channelRooms.length === 0) throw new StepBlockedError('The rooms of the channel are not in yet');
        }
      },
      render: ({ goTo }) => (
        <ImportStep context={context} onFix={goTo} onAdvance={() => goTo(ACTIVATION_STEP.mapping)} onChoose={() => goTo(ACTIVATION_STEP.property)} />
      ),
    };

    const mappingStep: WizardStep<ActivationWizardValues> = {
      id: ACTIVATION_STEP.mapping,
      label: t('marketplace.activation.steps.mapping.label'),
      title: t('marketplace.activation.steps.mapping.title'),
      purpose: t('marketplace.activation.steps.mapping.purpose'),
      nextLabel: t('marketplace.activation.mapping.next'),
      /**
       * «Salva e continua»: what the person decided, saved for each property. Every room has a decision and at least one is mapped, or nothing leaves (an empty
       * choice is never «all the rooms»); the rooms are those the channel manager holds now, not what the screen showed.
       */
      beforeNext: async (answers) => {
        setFailing('mappingSave');
        const ready: Array<{ id: string; mappings: ReturnType<typeof roomChoicesToSave> }> = [];
        for (const propertyId of answers.propertyIds) {
          const activationId = await resolveActivationId(propertyId);
          if (!activationId) throw new StepBlockedError('A property with no connection has no rooms to map');
          const choices = roomChoices((await fetchActivationMapping(queryClient, activationId)).channelRooms, overrides[propertyId] ?? {});
          const problem = mappingProblem(choices);
          if (problem) {
            setShowMappingErrors(true);
            setFailing(problem === 'noneMapped' ? 'mappingNone' : 'mappingUndecided');
            throw new StepBlockedError('The mapping of the rooms is not ready to be saved');
          }
          ready.push({ id: activationId, mappings: roomChoicesToSave(choices) });
        }
        for (const { id, mappings } of ready) await saveMapping.mutateAsync({ id, mappings });
      },
      render: ({ goTo }) => (
        <MappingStep
          context={context}
          overrides={overrides}
          onChange={(propertyId, channelRoomId, productId) =>
            setOverrides((current) => ({ ...current, [propertyId]: { ...current[propertyId], [channelRoomId]: productId } }))
          }
          showErrors={showMappingErrors}
          onFix={goTo}
          onChoose={() => goTo(ACTIVATION_STEP.property)}
        />
      ),
    };

    const activateStep: WizardStep<ActivationWizardValues> = {
      id: ACTIVATION_STEP.activate,
      label: t('marketplace.activation.steps.activate.label'),
      title: t('marketplace.activation.steps.activate.title'),
      purpose: t('marketplace.activation.steps.activate.purpose'),
      render: ({ goTo }) => <ActivateStep context={context} onChoose={() => goTo(ACTIVATION_STEP.property)} />,
    };

    const built: Record<ActivationStepId, WizardStep<ActivationWizardValues>> = {
      [ACTIVATION_STEP.property]: propertyStep,
      [ACTIVATION_STEP.access]: accessStep,
      [ACTIVATION_STEP.connection]: connectionStep,
      [ACTIVATION_STEP.import]: importStep,
      [ACTIVATION_STEP.mapping]: mappingStep,
      [ACTIVATION_STEP.activate]: activateStep,
    };
    return activationStepIds(requirements).map((id) => built[id]);
  };

  const failedMessage = {
    property: t('marketplace.activation.errors.propertyNotLinked'),
    access: t('marketplace.activation.errors.accessIncomplete'),
    connection: t('marketplace.activation.errors.connectionNotReady'),
    import: t('marketplace.activation.errors.roomsNotIn'),
    mappingNone: t('marketplace.activation.errors.mappingNone'),
    mappingUndecided: t('marketplace.activation.errors.mappingUndecided'),
    mappingSave: t('marketplace.activation.errors.mappingSave'),
  }[failing];

  return (
    <WizardFrame
      title={channelName ? t('marketplace.activation.title', { name: channelName }) : t('marketplace.activation.titleGeneric')}
      description={t('marketplace.activation.description')}
      testId="activation-wizard-page"
    >
      <WizardShell<ActivationWizardValues, ActivationResult>
        key={attempt}
        id={activationWizardId(kind, code)}
        steps={stepsFor(ACTIVATION_WIZARD_DEFAULTS)}
        stepsFor={stepsFor}
        defaultValues={restart ?? { ...ACTIVATION_WIZARD_DEFAULTS, propertyIds: requestedPropertyId ? [requestedPropertyId] : [] }}
        draft={{ version: ACTIVATION_DRAFT_VERSION }}
        finishLabel={t('marketplace.activation.activate.finish', { name })}
        finishFailedMessage={failedMessage}
        onFinish={activateAll}
        onExit={() => navigate(exitPath)}
        aboveFooter={
          // The guided step of the panel has its own «Salva ed esci», and the steps keep their own buttons as they are: one is enough on the screen.
          needsPanel && panelAvailability === 'ready' && searchParams.get('step') === ACTIVATION_STEP.access ? null : (
            <SaveAndExit label={t('marketplace.activation.exit.saveAndExit')} onLeave={leave} testId="activation-save-exit" />
          )
        }
        renderDone={({ result, values }) => (
          <ResultStep
            context={context}
            outcomes={result?.outcomes ?? null}
            exitPath={exitPath}
            onFix={(propertyId, step) => reopenAt(propertyId, step, values)}
          />
        )}
        testIds={{
          root: 'activation-wizard',
          back: 'activation-back',
          next: 'activation-next',
          finish: 'activation-finish',
          exit: 'activation-exit',
          finishError: 'activation-finish-error',
        }}
      />
    </WizardFrame>
  );
}

/**
 * `/app/short-rent/marketplace/activate/:kind/:code` (E09/F02/US04, MKT-03): the guided activation of a sales channel (`channel`) or a connected tool (`tool`)
 * through the channel manager's API: the properties, what the portal asks for, the connection, the import, the mapping of the rooms, the activation and the result.
 * `?propertyId=` is the property the marketplace was about, chosen from the start; `?returnTo=` is the page the person came from, where «Salva ed esci» and the end of
 * the wizard lead (the Marketplace page when there is none, or it is not a page of the app). An address that names neither a channel nor a tool is told, not opened.
 */
export function ActivationWizardPage() {
  const { t } = useTranslation();
  const { kind: kindSlug, code } = useParams();
  const kind = connectionKindOfSlug(kindSlug);
  // The kind and the code end up in the path of requests: nothing that could carry a path or a query goes through.
  const valid = kind !== null && code !== undefined && parseMarketplaceEntry(`${kind}:${code}`) !== null;

  if (!valid) {
    return (
      <WizardFrame title={t('marketplace.activation.titleGeneric')} testId="activation-wizard-page">
        <EmptyState
          icon={Store}
          title={t('marketplace.activation.notFound.title')}
          description={t('marketplace.activation.notFound.text')}
          action={{ label: t('marketplace.activation.notFound.back'), href: MARKETPLACE_PATH }}
        />
      </WizardFrame>
    );
  }

  return <ActivationWizard kind={kind} code={code} />;
}
