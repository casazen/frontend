import { useState, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Home, ShieldOff } from 'lucide-react';
import { toast } from 'sonner';
import { z, type ZodType } from 'zod';
import type { FieldValues } from 'react-hook-form';
import { AppShell } from '@/components/layout/app-shell';
import { FOCUS_COLUMN } from '@/components/layout/page-columns';
import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { WizardShell, type WizardStep } from '@/components/shared/wizard/wizard-shell';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { SkeletonLine } from '@/components/ui/skeleton';
import { CONNECTION_HEALTH_SECTION } from '@/features/compliance/lib/connection-health-model';
import { EMPTY_QUESTURA_CREDENTIALS, validateQuesturaCredentials, type QuesturaCredentialsErrors, type QuesturaCredentialsField } from '@/features/properties/components/questura-credentials-form';
import { useWorkspace } from '@/hooks/use-workspace';
import { getHttpStatus } from '@/lib/api-errors';
import { cn } from '@/lib/utils';
import { COMPLIANCE_HEALTH_KEY } from '@/queries/compliance-health';
import { PROPERTY_SENDER_KEY, useDeclareActivated, useSender, useSwitchSender, useTestConnection } from '@/queries/use-property-sender';
import { useProperties } from '@/queries/use-properties';
import { useSetQuesturaCredentials } from '@/queries/use-questura-credentials';
import type { WizardDraft } from '@/lib/wizard-draft';
import type { PropertySender } from '@/types';
import type { ComplianceSenderType } from '@/types/checkin-wizard.types';
import type { SetQuesturaCredentialsRequest } from '@/types/questura-credentials.types';
import { SenderWizardDone } from './sender-wizard-done';
import { SenderWizardExit } from './sender-wizard-exit';
import {
  SENDER_DRAFT_EXCLUDE,
  SENDER_DRAFT_VERSION,
  SENDER_STEP,
  SENDER_WIZARD_DEFAULTS,
  SENDER_WRITE_PERMISSION,
  SenderStepBlockedError,
  defaultSenderChoice,
  delegationSettled,
  hasTypedCredentials,
  propertyOfAddress,
  senderOptions,
  senderStepIds,
  senderWizardHref,
  senderWizardId,
  switchConfirmed,
  switchProblemOf,
  toSwitchRequest,
  type SenderStepId,
  type SenderWizardValues,
  type StepProblemKind,
} from './sender-wizard-model';
import { ConnectionTestStep } from './steps/connection-test-step';
import { CredentialsStep } from './steps/credentials-step';
import { SenderPanelStep } from './steps/panel-step';
import { SenderChoiceStep } from './steps/sender-choice-step';
import { SenderSummaryStep } from './steps/sender-summary-step';

type StepSchema = ZodType<unknown, FieldValues>;

const PROPERTIES_PATH = '/app/short-rent/properties';
const COMPLIANCE_PATH = '/app/short-rent/compliance';

/** The short-rent properties of the host, in the order the app lists them: what the page offers when the address names none. */
const SHORT_RENT = { mode: 'short' } as const;

/** The page of the property on the section that tells who sends and whether it works: where the wizard is left to, and where its result leads. */
const stateAddress = (propertyId: string) =>
  `${PROPERTIES_PATH}/${encodeURIComponent(propertyId)}?${new URLSearchParams({ section: CONNECTION_HEALTH_SECTION }).toString()}`;

/** The rules of the first step: one of the ways the server lets the host choose, and, for an automatic one, the delegation settled. The messages are i18n keys, as in every form. */
function choiceSchema(read: PropertySender): StepSchema {
  const choosable = senderOptions(read).filter((option) => option.available).map((option) => option.sender as string);
  return z
    .object({ sender: z.string(), delegationConsentVersion: z.string() })
    .refine((values) => choosable.includes(values.sender), { message: 'compliance.sender.errors.chooseOne', path: ['sender'] })
    .refine((values) => delegationSettled({ ...SENDER_WIZARD_DEFAULTS, ...values, sender: values.sender as ComplianceSenderType | '' }, read), {
      message: 'compliance.sender.errors.consentRequired',
      path: ['delegationConsentVersion'],
    });
}

/** The rules of the summary: the same choice, and the change confirmed when the sender really changes (the server asks it too). */
function summarySchema(read: PropertySender): StepSchema {
  const choosable = senderOptions(read).filter((option) => option.available).map((option) => option.sender as string);
  return z
    .object({ sender: z.string(), delegationConsentVersion: z.string(), switchConfirmed: z.string() })
    .refine((values) => choosable.includes(values.sender), { message: 'compliance.sender.errors.chooseOne', path: ['sender'] })
    .refine((values) => delegationSettled(values as SenderWizardValues, read), {
      message: 'compliance.sender.errors.consentRequired',
      path: ['delegationConsentVersion'],
    })
    .refine((values) => switchConfirmed(values as SenderWizardValues, read), { message: 'compliance.sender.errors.confirmRequired', path: ['switchConfirmed'] });
}

/** A draft that names a way the host cannot choose now is not a way to start from: it is dropped (and the wizard starts from what the server says). */
const draftOfAChoosableSender =
  (read: PropertySender) =>
  (draft: WizardDraft): boolean => {
    const sender = draft.values.sender;
    return sender === undefined || sender === '' || senderOptions(read).some((option) => option.available && option.sender === sender);
  };

interface ConfirmFirstProps {
  onGo: () => void;
}

/** A step that works on the sender in effect, opened while the choice has not been confirmed (a link, a draft, the back button): it says so and leads to the summary. */
function ConfirmFirst({ onGo }: ConfirmFirstProps) {
  const { t } = useTranslation();

  return (
    <Alert
      variant="warning"
      data-testid="sender-confirm-first"
      action={
        <Button type="button" size="sm" variant="outline" className="h-auto min-h-11 whitespace-normal py-2 text-center leading-tight" onClick={onGo} data-testid="sender-confirm-first-go">
          {t('compliance.sender.confirmFirst.go')}
        </Button>
      }
    >
      {t('compliance.sender.confirmFirst.text')}
    </Alert>
  );
}

interface SenderWizardProps {
  propertyId: string;
  read: PropertySender;
}

/**
 * The wizard once the sender is read (`WizardShell`, like the other guided flows): who sends, a summary, the credentials of the portal (optional), the passage on the panel of the channel
 * manager and the connection test, with a result at the end. The steps follow the first answer: the host's own send ends at the summary, CasaZen has no panel, the channel manager has them all. The
 * sender is changed once, at the button of the summary, and every later step works on the sender the server holds (never on the answer of the form); the connection test and the declaration
 * are the only way to «attivo» and to «dichiarato attivo», and each of them is the server's word. «Aiuto» and «Salva ed esci» are on every step; the answers are the draft of the property on the
 * server (the credentials, which are never an answer of the wizard, are not part of it) and the wizard resumes at the same step.
 */
function SenderWizard({ propertyId, read }: SenderWizardProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const switchSender = useSwitchSender(propertyId);
  const testConnection = useTestConnection(propertyId);
  const declareActivated = useDeclareActivated(propertyId);
  const saveCredentials = useSetQuesturaCredentials(propertyId);
  // What the last button of a step was stopped by, to tell it in words (the shell shows the message of an error that has none of its own).
  const [blocked, setBlocked] = useState<StepProblemKind | null>(null);
  // The credentials of the portal as they are typed: in the state of the wizard and in no value of its form, so in no draft, no address and no cache; they leave with the save.
  const [typedCredentials, setTypedCredentials] = useState<SetQuesturaCredentialsRequest>(EMPTY_QUESTURA_CREDENTIALS);
  const [credentialErrors, setCredentialErrors] = useState<QuesturaCredentialsErrors>({});
  // Any request of the wizard in flight: none of its buttons can be pressed again meanwhile.
  const busy = switchSender.isPending || testConnection.isPending || declareActivated.isPending || saveCredentials.isPending;

  const [defaults] = useState<SenderWizardValues>(() => ({ ...SENDER_WIZARD_DEFAULTS, sender: defaultSenderChoice(read) }));
  const leaveTo = stateAddress(propertyId);
  const tested = testConnection.data !== undefined;
  const verified = read.state === 'Active' && read.verification === 'Verified';

  const refreshSender = () => {
    void queryClient.invalidateQueries({ queryKey: [PROPERTY_SENDER_KEY, propertyId] });
    void queryClient.invalidateQueries({ queryKey: [COMPLIANCE_HEALTH_KEY, propertyId] });
  };

  /**
   * The button of the summary: the sender is changed (`PUT`). The consent goes with the version of the text the host read and the confirmation only for the change they confirmed. A refusal that says what
   * to do is told in words (and the sender is read again, so the screen shows what is true now); the wizard does not go on.
   */
  const applySwitch = async (values: SenderWizardValues) => {
    setBlocked(null);
    try {
      await switchSender.mutateAsync(toSwitchRequest(values, read));
    } catch (error) {
      const kind = switchProblemOf(error);
      if (kind === null) throw error;
      setBlocked(kind);
      refreshSender();
      throw new SenderStepBlockedError(kind);
    }
  };

  const typedCredentialsPending = hasTypedCredentials(typedCredentials);

  const changeCredential = (field: QuesturaCredentialsField, value: string) => {
    setTypedCredentials((current) => ({ ...current, [field]: value }));
    setCredentialErrors((current) => ({ ...current, [field]: undefined }));
  };

  /**
   * Sends the credentials that were typed (`PUT`): the button of the step, Enter in a field and the main button of the wizard all come here. A field that is missing or too long is told on the
   * field; a refusal of the server is told by the toast of the hook and the values stay in the fields, to be corrected. Whatever the end, the mutation keeps nothing of the request, and
   * a save empties the fields.
   */
  const saveTypedCredentials = async (): Promise<'saved' | 'invalid' | 'refused'> => {
    const found = validateQuesturaCredentials(typedCredentials);
    setCredentialErrors(found);
    if (Object.keys(found).length > 0) return 'invalid';
    try {
      await saveCredentials.mutateAsync(typedCredentials);
    } catch {
      saveCredentials.reset();
      return 'refused';
    }
    saveCredentials.reset();
    setTypedCredentials(EMPTY_QUESTURA_CREDENTIALS);
    refreshSender();
    return 'saved';
  };

  /**
   * The main button of the credentials step: what was typed is saved before the step is left (nothing typed, nothing to save: the step is optional). A step that cannot save them stays, with
   * the words of why, instead of going on and leaving them behind.
   */
  const saveCredentialsBeforeNext = async () => {
    setBlocked(null);
    if (!hasTypedCredentials(typedCredentials)) return;
    const outcome = await saveTypedCredentials();
    if (outcome === 'saved') return;
    const kind = outcome === 'invalid' ? 'credentialsIncomplete' : 'credentialsNotSaved';
    setBlocked(kind);
    throw new SenderStepBlockedError(kind);
  };

  // «Salva ed esci» keeps the answers of the wizard as its draft and nothing else: the credentials that were typed are not part of it, and the person is told.
  const saveAndExit = () => {
    if (typedCredentialsPending) toast.warning(t('compliance.sender.exit.savedWithoutCredentials'));
    else toast.success(t('compliance.sender.exit.saved'));
    navigate(leaveTo);
  };

  const stepsFor = (values: SenderWizardValues): WizardStep<SenderWizardValues>[] => {
    // The steps after the summary work on the sender in effect: until the host has confirmed the choice they say so and lead back.
    const confirmed = read.sender === values.sender;
    const canFinish = tested || read.state === 'Declared' || verified;

    const built: Record<SenderStepId, WizardStep<SenderWizardValues>> = {
      [SENDER_STEP.choice]: {
        id: SENDER_STEP.choice,
        label: t('compliance.sender.steps.choice.label'),
        title: t('compliance.sender.steps.choice.title'),
        purpose: t('compliance.sender.steps.choice.purpose'),
        schema: choiceSchema(read),
        nextDisabled: busy,
        render: () => <SenderChoiceStep read={read} />,
      },
      [SENDER_STEP.summary]: {
        id: SENDER_STEP.summary,
        label: t('compliance.sender.steps.summary.label'),
        title: t('compliance.sender.steps.summary.title'),
        purpose: t('compliance.sender.steps.summary.purpose'),
        schema: summarySchema(read),
        nextLabel: t('compliance.sender.steps.summary.next'),
        nextDisabled: busy,
        beforeNext: applySwitch,
        render: () => <SenderSummaryStep read={read} />,
      },
      [SENDER_STEP.credentials]: {
        id: SENDER_STEP.credentials,
        label: t('compliance.sender.steps.credentials.label'),
        title: t('compliance.sender.steps.credentials.title'),
        purpose: t('compliance.sender.steps.credentials.purpose'),
        optional: true,
        // With credentials typed the main button saves them first: it says so.
        nextLabel: typedCredentialsPending ? t('compliance.sender.steps.credentials.saveAndNext') : undefined,
        nextDisabled: busy || !confirmed,
        beforeNext: saveCredentialsBeforeNext,
        render: ({ goTo }) =>
          confirmed ? (
            <CredentialsStep
              read={read}
              busy={busy}
              values={typedCredentials}
              errors={credentialErrors}
              onChange={changeCredential}
              onSave={() => void saveTypedCredentials()}
            />
          ) : (
            <ConfirmFirst onGo={() => goTo(SENDER_STEP.summary)} />
          ),
      },
      [SENDER_STEP.panel]: {
        id: SENDER_STEP.panel,
        label: t('compliance.sender.steps.panel.label'),
        title: t('compliance.sender.steps.panel.title'),
        purpose: t('compliance.sender.steps.panel.purpose'),
        nextLabel: t('compliance.sender.steps.panel.next'),
        nextDisabled: busy || !confirmed,
        render: ({ goTo }) =>
          confirmed ? (
            <SenderPanelStep propertyId={propertyId} onContinue={() => goTo(SENDER_STEP.test)} onSaveAndExit={saveAndExit} />
          ) : (
            <ConfirmFirst onGo={() => goTo(SENDER_STEP.summary)} />
          ),
      },
      [SENDER_STEP.test]: {
        id: SENDER_STEP.test,
        label: t('compliance.sender.steps.test.label'),
        title: t('compliance.sender.steps.test.title'),
        purpose: t('compliance.sender.steps.test.purpose'),
        // The wizard ends on a test: until the host has run one (or the server already holds a verified or a declared state) there is nothing to conclude.
        nextDisabled: busy || !confirmed || !canFinish,
        render: ({ goTo }) =>
          confirmed ? (
            <ConnectionTestStep
              read={read}
              result={testConnection.data}
              testError={testConnection.error}
              declareError={declareActivated.error}
              busy={busy}
              onTest={() => {
                declareActivated.reset();
                testConnection.mutate();
              }}
              onDeclare={() => declareActivated.mutate()}
              onFix={(step) => goTo(step)}
            />
          ) : (
            <ConfirmFirst onGo={() => goTo(SENDER_STEP.summary)} />
          ),
      },
    };
    return senderStepIds(values.sender).map((id) => built[id]);
  };

  return (
    <WizardShell<SenderWizardValues, null>
      id={senderWizardId(propertyId)}
      steps={stepsFor(defaults)}
      stepsFor={stepsFor}
      defaultValues={defaults}
      // The answers are the draft of the property on the server, resumed on any device; a draft that names a way that cannot be chosen now is dropped. The confirmation of a change is not kept, and the
      // credentials are not an answer of the wizard: they are in no draft.
      draft={{
        exclude: SENDER_DRAFT_EXCLUDE,
        version: SENDER_DRAFT_VERSION,
        accept: draftOfAChoosableSender(read),
        server: { type: 'ComplianceSender', entityId: propertyId },
      }}
      finishLabel={t('compliance.sender.finish')}
      finishFailedMessage={blocked ? t(`compliance.sender.errors.${blocked}`) : t('compliance.sender.errors.switchFailed')}
      onFinish={() => null}
      onExit={() => navigate(leaveTo)}
      navigationDisabled={busy}
      renderDone={() => <SenderWizardDone propertyId={propertyId} />}
      belowFooter={<SenderWizardExit onSaveAndExit={saveAndExit} />}
      testIds={{
        root: 'sender-wizard',
        back: 'sender-back',
        next: 'sender-next',
        finish: 'sender-finish',
        exit: 'sender-exit',
        finishError: 'sender-finish-error',
      }}
    />
  );
}

/** What the page offers when its address names no property: the properties of the host, each leading to the wizard for it. */
function PropertyPicker() {
  const { t } = useTranslation();
  const properties = useProperties(SHORT_RENT);

  if (properties.isError) {
    return <ErrorState testId="sender-wizard-properties-error" title={t('compliance.sender.pick.loadError')} error={properties.error} onRetry={() => void properties.refetch()} />;
  }
  if (properties.isPending) {
    return (
      <div data-testid="sender-wizard-properties-loading">
        <SkeletonLine lines={3} lineClassName="h-10" label={t('compliance.sender.pick.loading')} />
      </div>
    );
  }
  if (properties.data.length === 0) {
    return <EmptyState icon={Home} title={t('compliance.sender.pick.emptyTitle')} description={t('compliance.sender.pick.emptyText')} action={{ label: t('compliance.sender.pick.emptyAction'), href: PROPERTIES_PATH }} />;
  }

  return (
    <section className="min-w-0 space-y-3" aria-labelledby="sender-pick-title" data-testid="sender-wizard-pick">
      <h2 id="sender-pick-title" className="text-base font-semibold">
        {t('compliance.sender.pick.title')}
      </h2>
      <ul role="list" className="divide-y divide-border rounded-md border border-border">
        {properties.data.map((property) => (
          <li key={property.id}>
            <Link
              to={senderWizardHref(property.id)}
              className="flex min-h-11 flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 py-3 text-sm font-medium hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              data-testid={`sender-pick-${property.id}`}
            >
              <span className="min-w-0 break-words">{property.name}</span>
              {property.city ? <span className="min-w-0 break-words font-normal text-foreground/70">{property.city}</span> : null}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The sender of one property, read: what the page shows is what the read says, and a read that failed is never shown as a sender that is fine. */
function SenderWizardLoader({ propertyId }: { propertyId: string }) {
  const { t } = useTranslation();
  const sender = useSender(propertyId);

  // A 404 is «not found» whatever the cache still holds of an older read (the query keeps the last data on an error).
  if (sender.isError && getHttpStatus(sender.error) === 404) {
    return (
      <EmptyState
        icon={Home}
        title={t('compliance.sender.notFound.title')}
        description={t('compliance.sender.notFound.text')}
        action={{ label: t('compliance.sender.notFound.back'), href: PROPERTIES_PATH }}
      />
    );
  }
  if (!sender.data) {
    return sender.isError ? (
      <ErrorState testId="sender-wizard-error" title={t('compliance.sender.loadError')} error={sender.error} onRetry={() => void sender.refetch()} showSupport />
    ) : (
      <div data-testid="sender-wizard-loading">
        <SkeletonLine lines={3} lineClassName="h-10" label={t('compliance.sender.loading')} />
      </div>
    );
  }
  if (!sender.data.applies) {
    return (
      <EmptyState
        icon={ShieldOff}
        title={t('compliance.sender.notApplicable.title')}
        description={t('compliance.sender.notApplicable.text')}
        action={{ label: t('compliance.sender.notApplicable.back'), href: `${PROPERTIES_PATH}/${encodeURIComponent(propertyId)}` }}
      />
    );
  }

  return (
    <>
      {sender.isError ? (
        // A later read failed (the wizard keeps what it had): the state on screen may be older than the server's, and the person is told.
        <Alert
          variant="warning"
          data-testid="sender-wizard-stale"
          action={
            <Button type="button" size="sm" variant="outline" className="h-auto min-h-11 whitespace-normal py-2 text-center leading-tight" onClick={() => void sender.refetch()}>
              {t('compliance.sender.stale.retry')}
            </Button>
          }
        >
          {t('compliance.sender.stale.text')}
        </Alert>
      ) : null}
      <SenderWizard propertyId={propertyId} read={sender.data} />
    </>
  );
}

/**
 * «Attiva l'invio automatico alla Polizia» (E03/F01/US02/T02, NF-42, NF-49): the wizard that sets who sends the guest data to the police (and ISTAT) for one property, `?property=<id>`. It is
 * entered from the panel «Invio a Polizia e ISTAT» of the property page, the cockpit of the adempimenti and the plan of the activation, and it is in no menu. It asks `property.write`, as the endpoints
 * that change the sender do: without it nothing is asked of the server. A property that is not found is said so, and one outside Italy has no sender to choose.
 */
export function SenderWizardPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const { hasPermission } = useWorkspace();
  const canWrite = hasPermission('short-rent', SENDER_WRITE_PERMISSION);
  const propertyId = propertyOfAddress(searchParams);
  const title = t('compliance.sender.title');

  let body: ReactNode;
  if (!canWrite) {
    body = (
      <EmptyState
        icon={ShieldOff}
        title={t('compliance.sender.noPermission.title')}
        description={t('compliance.sender.noPermission.text')}
        action={{ label: t('compliance.sender.noPermission.back'), href: propertyId ? stateAddress(propertyId) : COMPLIANCE_PATH }}
      />
    );
  } else if (propertyId === '') {
    body = <PropertyPicker />;
  } else {
    body = <SenderWizardLoader key={propertyId} propertyId={propertyId} />;
  }

  return (
    <AppShell>
      <div className={cn(FOCUS_COLUMN, 'space-y-6 md:space-y-8')} data-testid="sender-wizard-page">
        <PageHeader title={title} description={t('compliance.sender.description')} crumbs={[{ label: t('nav.compliance'), to: COMPLIANCE_PATH }, { label: title }]} />
        {body}
      </div>
    </AppShell>
  );
}
