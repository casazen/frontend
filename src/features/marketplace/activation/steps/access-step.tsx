import { useEffect, useRef } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, Clock, Loader2 } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { AssistRequestButton } from '@/features/onboarding/components/assist-request-button';
import { OctoratePanelStep } from '@/features/onboarding/components/octorate-panel-step';
import { findPanelStep, isPanelStepDone, panelAssistContext, panelPartOf } from '@/lib/onboarding-panel';
import { refreshActivation, useActivations } from '@/queries/use-marketplace';
import type { PanelStep } from '@/types/onboarding.types';
import { SaveAndExit } from '../../components/wizard-frame';
import {
  CREDENTIAL_MAX_LENGTH,
  HOTEL_ID_MAX_LENGTH,
  activationPanelResume,
  missingAccess,
  panelAccessStatus,
  propertyNameOf,
  type ActivationContext,
  type ActivationWizardValues,
  type PortalCredentials,
} from '../activation-wizard-model';
import { ChoosePropertyFirst } from './choose-property-first';

/** At least 44 px high on every device, and a long label wraps instead of pushing the page sideways. */
const TOUCH_TARGET = 'h-auto min-h-11 whitespace-normal py-2 text-center leading-tight';

/** «Mi serve aiuto»: the request for help of the guided step, under the words of the fallback of a result CasaZen cannot read. */
const HELP_LABEL = 'needHelp';

/** Who can do the step on the panel of the channel manager: the organization administrator, and only while the guided steps of the activation are on. */
export type PanelAvailability = 'ready' | 'notAdmin' | 'unavailable';

/** The guided steps of the panel the wizard reads for the access step (`usePanelSteps`), and whether this person can do them. */
export interface PanelAccess {
  availability: PanelAvailability;
  /** The steps of the organization; `undefined` while they are read. */
  steps: readonly PanelStep[] | undefined;
}

interface PanelAccessSectionProps {
  context: ActivationContext;
  propertyIds: readonly string[];
  panel: PanelAccess;
  onSaveAndExit: () => void;
  /** A read of an activation began or ended: the page asks again whether «Continue» may be pressed. */
  onActivationsRead: () => void;
}

interface PanelNotGivenProps {
  context: ActivationContext;
  propertyId: string;
  /** The activation whose access the channel manager does not show: it is read again by «Check again». */
  activationId: string | null;
  onSaveAndExit: () => void;
}

/**
 * The access that the person said was given on the panel and that the channel manager does not show (it is what the import and the activation go by): told as not
 * given, never as done. The guided step cannot be done again (a step that is done is answered as it is), so the way on is to give the access on the panel of the channel
 * manager and check again, or to ask for help.
 */
function PanelNotGiven({ context, propertyId, activationId, onSaveAndExit }: PanelNotGivenProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const name = context.channelName ?? t('marketplace.activation.thisChannel');
  const property = propertyNameOf(context.properties, propertyId) ?? propertyId;

  return (
    <div className="min-w-0 space-y-3" data-testid="activation-panel-not-given">
      <Alert
        variant="warning"
        action={
          activationId ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className={TOUCH_TARGET}
              onClick={() => void refreshActivation(queryClient, activationId)}
              data-testid="activation-panel-recheck"
            >
              {t('marketplace.activation.access.panel.recheck')}
            </Button>
          ) : undefined
        }
      >
        {t('marketplace.activation.access.panel.notGiven', { property, name })}
      </Alert>
      <AssistRequestButton
        part={panelPartOf('channelAccess')}
        context={panelAssistContext('channelAccess')}
        propertyId={propertyId}
        channelCode={context.code}
        label={HELP_LABEL}
      />
      <SaveAndExit label={t('marketplace.activation.exit.saveAndExit')} onLeave={onSaveAndExit} testId="activation-panel-save-exit" />
    </div>
  );
}

/**
 * The access given on the panel of the channel manager, which Octorate allows only from there (S19, UX-02 point 3, NF-107): the wizard builds no passage of its
 * own. It mounts the guided step of the panel for the first property whose access is not given (it explains what will happen, opens the panel, checks the result
 * on return, raises the «Da fare» when the person leaves half way and offers «Fallo per me»), and shows where the others stand.
 *
 * Where the activation of the property exists, what the channel manager says of the access (`panelAccessDone`) is the proof, because it is what the import and the
 * activation go by: a guided step that the person confirmed before the connection existed (the first pass, when there was nothing to check) is only their word, and
 * is never shown as given against it (`panelAccessStatus`). Without an activation, or when it cannot be read, the guided step is all there is.
 */
function PanelAccessSection({ context, propertyIds, panel, onSaveAndExit, onActivationsRead }: PanelAccessSectionProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const available = panel.availability === 'ready';
  const stepOf = (propertyId: string) => findPanelStep(panel.steps, { kind: 'channelAccess', propertyId, channelCode: context.code });
  const stepDone = propertyIds.map((propertyId) => isPanelStepDone(stepOf(propertyId)));

  // The channel manager is asked only for the properties whose activation exists, and only for who can do the step.
  const activationIds = propertyIds.map((propertyId) => (available ? (context.plans.get(propertyId)?.activationId ?? null) : null));
  const reads = useActivations(activationIds);
  const readKey = reads.map((read) => `${read.dataUpdatedAt}:${read.fetchStatus}`).join('|');
  useEffect(() => {
    onActivationsRead();
  }, [readKey, onActivationsRead]);

  // A guided step that has just been done has made the channel manager know it: what was read before is read again, so that an old «not given» does not stand over it.
  // The steps that were done when they were first known are not «just done»: nothing is asked again for them.
  const stepsRead = panel.steps !== undefined;
  const doneIds = activationIds.filter((id, index): id is string => id !== null && stepDone[index]).join('|');
  const lastDoneIds = useRef<string | null>(null);
  useEffect(() => {
    if (!stepsRead) return;
    const before = lastDoneIds.current;
    lastDoneIds.current = doneIds;
    if (before === null || before === doneIds) return;
    for (const id of doneIds.split('|')) if (id !== '') void refreshActivation(queryClient, id);
  }, [stepsRead, doneIds, queryClient]);

  if (panel.availability === 'unavailable') {
    return (
      <Alert variant="info" data-testid="activation-panel-unavailable">
        {t('marketplace.activation.access.panel.unavailable')}
      </Alert>
    );
  }
  if (panel.availability === 'notAdmin') {
    return (
      <p className="rounded-lg bg-muted p-4 text-sm" data-testid="activation-panel-admin-only">
        {t('onboardingPlan.panel.adminOnly')}
      </p>
    );
  }
  if (panel.steps === undefined) {
    return (
      <div className="flex items-center gap-3 rounded-lg bg-muted p-4 text-sm" role="status" data-testid="activation-panel-loading">
        <Loader2 aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" />
        {t('marketplace.activation.access.panel.loading')}
      </div>
    );
  }

  const statuses = propertyIds.map((_, index) =>
    panelAccessStatus({
      hasActivation: activationIds[index] !== null,
      panelAccessDone: reads[index]?.data?.panelAccessDone,
      reading: reads[index]?.fetchStatus === 'fetching',
      stepDone: stepDone[index],
    }),
  );
  const currentIndex = statuses.findIndex((status) => status !== 'given');
  const current = currentIndex === -1 ? undefined : propertyIds[currentIndex];
  const currentStatus = currentIndex === -1 ? 'given' : statuses[currentIndex];
  const name = context.channelName ?? t('marketplace.activation.thisChannel');

  return (
    <section className="min-w-0 space-y-4" aria-labelledby="activation-panel-title" data-testid="activation-panel-access">
      <h3 id="activation-panel-title" className="text-base font-semibold">
        {t('marketplace.activation.access.panel.title', { name })}
      </h3>
      {propertyIds.length > 1 ? (
        <ul className="space-y-1 text-sm" role="list">
          {propertyIds.map((propertyId, index) => {
            const done = statuses[index] === 'given';
            const Icon = done ? CheckCircle2 : Clock;
            return (
              <li key={propertyId} className="flex items-center gap-2" data-testid={`activation-panel-${propertyId}`} data-done={done}>
                <Icon aria-hidden="true" className="size-4 shrink-0" />
                <span className="min-w-0 break-words">
                  {t(done ? 'marketplace.activation.access.panel.done' : 'marketplace.activation.access.panel.waiting', {
                    property: propertyNameOf(context.properties, propertyId) ?? propertyId,
                  })}
                </span>
              </li>
            );
          })}
        </ul>
      ) : null}
      {current === undefined ? (
        <Alert variant="success" data-testid="activation-panel-all-done">
          {t('marketplace.activation.access.panel.allDone')}
        </Alert>
      ) : currentStatus === 'reading' ? (
        <div className="flex items-center gap-3 rounded-lg bg-muted p-4 text-sm" role="status" data-testid="activation-panel-reading">
          <Loader2 aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" />
          {t('marketplace.activation.access.panel.loading')}
        </div>
      ) : currentStatus === 'notGiven' ? (
        <PanelNotGiven context={context} propertyId={current} activationId={activationIds[currentIndex]} onSaveAndExit={onSaveAndExit} />
      ) : (
        <OctoratePanelStep
          key={current}
          kind="channelAccess"
          propertyId={current}
          channelCode={context.code}
          channelName={context.channelName}
          resume={activationPanelResume(context.kind)}
          onSaveAndExit={onSaveAndExit}
        />
      )}
    </section>
  );
}

interface AccessStepProps {
  context: ActivationContext;
  /** The username and the password of the portal: the state of the page, never a value of the wizard, so never in its draft or in the storage of the browser. */
  credentials: PortalCredentials;
  onCredentialsChange: (next: PortalCredentials) => void;
  /** The person pressed «Continue» with something missing: the fields that lack it say so. */
  showErrors: boolean;
  panel: PanelAccess;
  onSaveAndExit: () => void;
  /** The access on the panel was read for an activation: the page asks again whether «Continue» may be pressed. */
  onActivationsRead: () => void;
  /** Goes back to the step where the properties are chosen. */
  onChoose: () => void;
}

/**
 * Step «Accesso» (E09/F02/US04/T01, NF-56): it asks only for what the portal asks for. The identifier of each property on the channel when the portal asks
 * for `hotelId` (a value of the wizard, kept in its draft: it is not a secret); the username and the password when it asks for `credentials`; the access on
 * the panel of the channel manager when it asks for `panelAccess` (the guided step of the panel, mounted as it is). A portal that asks for nothing has no
 * such step: the list of steps drops it.
 *
 * The username and the password stay in the state of the page: they are sent once, to `POST /api/marketplace/activations`, and cleared; after a reload the
 * fields are empty and the step asks again. The password field is a password field and does not offer to be remembered.
 */
export function AccessStep({ context, credentials, onCredentialsChange, showErrors, panel, onSaveAndExit, onActivationsRead, onChoose }: AccessStepProps) {
  const { t } = useTranslation();
  const { control, setValue } = useFormContext<ActivationWizardValues>();
  const propertyIds = useWatch({ control, name: 'propertyIds' }) ?? [];
  const hotelIds = useWatch({ control, name: 'hotelIds' }) ?? {};
  const { requirements } = context;
  const name = context.channelName ?? t('marketplace.activation.thisChannel');

  if (propertyIds.length === 0) return <ChoosePropertyFirst onChoose={onChoose} />;
  if (requirements === null) {
    return (
      <div className="flex items-center gap-3 rounded-lg bg-muted p-4 text-sm" role="status" data-testid="activation-access-loading">
        <Loader2 aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" />
        {t('marketplace.activation.access.loading')}
      </div>
    );
  }
  if (!requirements.hotelId && !requirements.credentials && !requirements.panelAccess) {
    return (
      <p className="rounded-lg bg-muted p-4 text-sm" data-testid="activation-access-nothing">
        {t('marketplace.activation.access.nothing', { name })}
      </p>
    );
  }

  const missing = missingAccess(requirements, propertyIds, hotelIds, credentials);

  return (
    <div className="flex flex-col gap-6" data-testid="activation-access-step">
      {requirements.hotelId ? (
        <div className="min-w-0 space-y-4">
          {propertyIds.map((propertyId) => (
            <Field
              key={propertyId}
              label={t('marketplace.activation.access.hotelId.label', { property: propertyNameOf(context.properties, propertyId) ?? propertyId, name })}
              hint={t('marketplace.activation.access.hotelId.hint', { name })}
              error={showErrors && missing.hotelIdFor.includes(propertyId) ? t('marketplace.activation.access.hotelId.required') : undefined}
            >
              <Input
                value={hotelIds[propertyId] ?? ''}
                maxLength={HOTEL_ID_MAX_LENGTH}
                autoComplete="off"
                spellCheck={false}
                onChange={(event) => setValue(`hotelIds.${propertyId}`, event.target.value, { shouldDirty: true })}
                data-testid={`activation-hotel-id-${propertyId}`}
              />
            </Field>
          ))}
        </div>
      ) : null}

      {requirements.credentials ? (
        <div className="min-w-0 space-y-4" data-testid="activation-credentials">
          <Field
            label={t('marketplace.activation.access.username.label', { name })}
            error={showErrors && missing.username ? t('marketplace.activation.access.username.required') : undefined}
          >
            <Input
              value={credentials.username}
              maxLength={CREDENTIAL_MAX_LENGTH}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              onChange={(event) => onCredentialsChange({ ...credentials, username: event.target.value })}
              data-testid="activation-username"
            />
          </Field>
          <Field
            label={t('marketplace.activation.access.password.label', { name })}
            error={showErrors && missing.password ? t('marketplace.activation.access.password.required') : undefined}
          >
            <Input
              type="password"
              value={credentials.password}
              maxLength={CREDENTIAL_MAX_LENGTH}
              autoComplete="off"
              onChange={(event) => onCredentialsChange({ ...credentials, password: event.target.value })}
              data-testid="activation-password"
            />
          </Field>
          <p className="text-sm text-muted-foreground" data-testid="activation-credentials-note">
            {t('marketplace.activation.access.credentialsNote')}
            {propertyIds.length > 1 ? ` ${t('marketplace.activation.access.sameForAll')}` : ''}
          </p>
        </div>
      ) : null}

      {requirements.panelAccess ? (
        <PanelAccessSection context={context} propertyIds={propertyIds} panel={panel} onSaveAndExit={onSaveAndExit} onActivationsRead={onActivationsRead} />
      ) : null}
    </div>
  );
}
