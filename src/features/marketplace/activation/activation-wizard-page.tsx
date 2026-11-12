import { useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
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
import { useActivationPlans } from '@/queries/use-marketplace';
import { usePanelSteps } from '@/queries/use-onboarding-panel-step';
import { useProperties } from '@/queries/use-properties';
import type { MarketplaceActivationPlan, MarketplaceConnectionKind } from '@/types';
import { SaveAndExit, WizardFrame } from '../components/wizard-frame';
import { useWizardLeave, useWizardReturn } from '../lib/use-wizard-exit';
import { parseMarketplaceEntry } from '../lib/marketplace-entry';
import { MARKETPLACE_PATH, MARKETPLACE_PROPERTY_PARAM } from '../lib/marketplace-paths';
import {
  ACTIVATION_DRAFT_VERSION,
  ACTIVATION_STEP,
  ACTIVATION_WIZARD_DEFAULTS,
  NO_CREDENTIALS,
  activationStepIds,
  activationWizardId,
  connectionKindOfSlug,
  isAccessComplete,
  missingAccess,
  requirementsOf,
  type ActivationContext,
  type ActivationStepId,
  type ActivationWizardValues,
  type PortalCredentials,
} from './activation-wizard-model';
import { AccessStep, type PanelAccess, type PanelAvailability } from './steps/access-step';
import { PropertyStep } from './steps/property-step';

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
type Failing = 'property' | 'access';

/**
 * The wizard of a channel or a tool (E09/F02/US04): a `WizardShell` whose steps follow what the portal asks of the person. The steps, the plan that
 * says what the portal needs and the properties are read here and handed to the steps, which read nothing the page has read already.
 */
function ActivationWizard({ kind, code }: { kind: MarketplaceConnectionKind; code: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { exitPath } = useWizardReturn();
  const leave = useWizardLeave(exitPath, t('marketplace.activation.exit.saved'));
  const { contexts } = useWorkspace();
  const { flags } = useFeatureFlags();

  // The access data of the portal lives here and nowhere else: not in the values of the wizard, so never in its draft or in the storage of the browser.
  const [credentials, setCredentials] = useState<PortalCredentials>(NO_CREDENTIALS);
  const [showAccessErrors, setShowAccessErrors] = useState(false);
  const [failing, setFailing] = useState<Failing>('property');

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

    const built: Record<ActivationStepId, WizardStep<ActivationWizardValues> | undefined> = {
      [ACTIVATION_STEP.property]: propertyStep,
      [ACTIVATION_STEP.access]: accessStep,
      [ACTIVATION_STEP.connection]: undefined,
      [ACTIVATION_STEP.import]: undefined,
      [ACTIVATION_STEP.mapping]: undefined,
      [ACTIVATION_STEP.activate]: undefined,
    };

    return activationStepIds(requirements)
      .map((id) => built[id])
      .filter((step): step is WizardStep<ActivationWizardValues> => step !== undefined);
  };

  const failedMessage = {
    property: t('marketplace.activation.errors.propertyNotLinked'),
    access: t('marketplace.activation.errors.accessIncomplete'),
  }[failing];

  return (
    <WizardFrame
      title={channelName ? t('marketplace.activation.title', { name: channelName }) : t('marketplace.activation.titleGeneric')}
      description={t('marketplace.activation.description')}
      testId="activation-wizard-page"
    >
      <WizardShell<ActivationWizardValues>
        id={activationWizardId(kind, code)}
        steps={stepsFor(ACTIVATION_WIZARD_DEFAULTS)}
        stepsFor={stepsFor}
        defaultValues={{ ...ACTIVATION_WIZARD_DEFAULTS, propertyIds: requestedPropertyId ? [requestedPropertyId] : [] }}
        draft={{ version: ACTIVATION_DRAFT_VERSION }}
        finishLabel={t('marketplace.activation.activate.finish', { name })}
        finishFailedMessage={failedMessage}
        onFinish={() => undefined}
        onExit={() => navigate(exitPath)}
        aboveFooter={
          // The guided step of the panel has its own «Salva ed esci», and the steps keep their own buttons as they are: one is enough on the screen.
          needsPanel && panelAvailability === 'ready' && searchParams.get('step') === ACTIVATION_STEP.access ? null : (
            <SaveAndExit label={t('marketplace.activation.exit.saveAndExit')} onLeave={leave} testId="activation-save-exit" />
          )
        }
        renderDone={() => null}
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
 * `/app/short-rent/marketplace/activate/:kind/:code` (E09/F02/US04/T01, MKT-03): the guided activation of a sales channel (`channel`) or a connected tool
 * (`tool`) through the channel manager's API. `?propertyId=` is the property the marketplace was about, chosen from the start; `?returnTo=` is the page
 * the person came from, where «Salva ed esci» and the end of the wizard lead (the Marketplace page when there is none, or it is not a page of the app).
 * An address that names neither a channel nor a tool is told, not opened.
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
