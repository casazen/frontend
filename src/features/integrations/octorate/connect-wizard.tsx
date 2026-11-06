import { Navigate, useNavigate } from 'react-router-dom';
import { useWatch, type UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/page-header';
import { FOCUS_COLUMN } from '@/components/layout/page-columns';
import { WizardShell, type WizardStep } from '@/components/shared/wizard/wizard-shell';
import { Button } from '@/components/ui/button';
import { PROPERTIES_PATH } from '@/features/properties/properties-paths';
import { cn } from '@/lib/utils';
import { ConnectDone } from './connect-done';
import { ConsentStep } from './consent-step';
import { InventoryScenarioStep } from './inventory-scenario-step';
import { routeForScenario, SCENARIO_STEP_SCHEMA, type ConnectWizardValues } from './inventory-scenario';
import { CONSENT_STEP_ID } from './octorate-callback';
import { useOctorateConnect, type OctorateConnect } from './use-octorate-connect';
import { WhyConnectStep } from './why-connect-step';

/** Name of the flow: the draft (the answer to the first question and the step) lives under it. */
const WIZARD_ID = 'octorate-connect';

const SCENARIO_STEP_ID = 'scenario';
const WHY_STEP_ID = 'why';

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
 * The listings found, their mapping and the summary follow the consent as steps of the same wizard (E02/F01/US02/T05).
 */
function ConnectWizard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const connect = useOctorateConnect();

  const connected = connect.phase === 'connected';
  const retry = connect.phase === 'attention' || connect.phase === 'denied' || connect.phase === 'failed';
  const working = connect.phase === 'checking' || connect.phase === 'completing';

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
      // The main button sends the host to the channel manager; it waits while the state is read or the code is exchanged, and has
      // nothing to start once the connection works.
      beforeNext: connected ? undefined : connect.start,
      nextDisabled: working,
      render: ({ form }) => <ConnectionStep form={form} connect={connect} />,
    },
  ];

  return (
    <WizardShell<ConnectWizardValues, number | null>
      id={WIZARD_ID}
      steps={steps}
      // Back from the channel manager the answer to the first question is known whatever the draft remembers: only the consent leads
      // there. The address names no step: the host comes back to where they left, the consent.
      defaultValues={{ scenario: connect.returned ? 'onOctorate' : null }}
      initialStepId={connect.returned ? CONSENT_STEP_ID : undefined}
      // A draft that says otherwise (the host left another way and came back later) does not take the answer away from the consent.
      draft={{ accept: (saved) => !connect.returned || saved.values.scenario === 'onOctorate' }}
      finishLabel={t(
        connected ? 'octorate.connect.consent.next.finish' : retry ? 'octorate.connect.consent.next.retry' : 'octorate.connect.consent.next.start',
      )}
      finishFailedMessage={t('octorate.connect.finishFailed')}
      onFinish={() => connect.propertyCount}
      onExit={() => navigate(PROPERTIES_PATH)}
      aboveFooter={
        <SaveAndExit
          onLeave={() => {
            toast.success(t('octorate.connect.exit.saved'));
            navigate(PROPERTIES_PATH);
          }}
        />
      }
      renderDone={({ result }) => <ConnectDone propertyCount={result ?? null} fresh={result !== undefined} />}
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
