import { useFormContext, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, Clock, Loader2 } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { OctoratePanelStep } from '@/features/onboarding/components/octorate-panel-step';
import { findPanelStep, isPanelStepDone } from '@/lib/onboarding-panel';
import type { PanelStep } from '@/types/onboarding.types';
import {
  CREDENTIAL_MAX_LENGTH,
  HOTEL_ID_MAX_LENGTH,
  activationPanelResume,
  missingAccess,
  propertyNameOf,
  type ActivationContext,
  type ActivationWizardValues,
  type PortalCredentials,
} from '../activation-wizard-model';
import { ChoosePropertyFirst } from './choose-property-first';

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
}

/**
 * The access given on the panel of the channel manager, which Octorate allows only from there (S19, UX-02 point 3, NF-107): the wizard builds no passage of its
 * own. It mounts the guided step of the panel for the first property whose access is not given (it explains what will happen, opens the panel, checks the result
 * on return, raises the «Da fare» when the person leaves half way and offers «Fallo per me»), and shows where the others stand. The step is done when the
 * guided step of the property and the channel is done; the checks are the server's, and this part only reads them.
 */
function PanelAccessSection({ context, propertyIds, panel, onSaveAndExit }: PanelAccessSectionProps) {
  const { t } = useTranslation();

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

  const stepOf = (propertyId: string) => findPanelStep(panel.steps, { kind: 'channelAccess', propertyId, channelCode: context.code });
  const current = propertyIds.find((propertyId) => !isPanelStepDone(stepOf(propertyId)));
  const name = context.channelName ?? t('marketplace.activation.thisChannel');

  return (
    <section className="min-w-0 space-y-4" aria-labelledby="activation-panel-title" data-testid="activation-panel-access">
      <h3 id="activation-panel-title" className="text-base font-semibold">
        {t('marketplace.activation.access.panel.title', { name })}
      </h3>
      {propertyIds.length > 1 ? (
        <ul className="space-y-1 text-sm" role="list">
          {propertyIds.map((propertyId) => {
            const done = isPanelStepDone(stepOf(propertyId));
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
      {current ? (
        <OctoratePanelStep
          key={current}
          kind="channelAccess"
          propertyId={current}
          channelCode={context.code}
          channelName={context.channelName}
          resume={activationPanelResume(context.kind)}
          onSaveAndExit={onSaveAndExit}
        />
      ) : (
        <Alert variant="success" data-testid="activation-panel-all-done">
          {t('marketplace.activation.access.panel.allDone')}
        </Alert>
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
export function AccessStep({ context, credentials, onCredentialsChange, showErrors, panel, onSaveAndExit, onChoose }: AccessStepProps) {
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

      {requirements.panelAccess ? <PanelAccessSection context={context} propertyIds={propertyIds} panel={panel} onSaveAndExit={onSaveAndExit} /> : null}
    </div>
  );
}
