import { useEffect, useRef } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, CheckCircle2, Circle, Loader2 } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { getProblemMessage, translateErrorCode } from '@/lib/api-errors';
import { useActivations, useStartActivation } from '@/queries/use-marketplace';
import {
  ACTIVATION_STEP,
  CHANNEL_REFUSAL_CODE,
  isAccessComplete,
  missingAccess,
  problemCodeOf,
  propertyNameOf,
  startRequestFor,
  stepToFix,
  type ActivationContext,
  type ActivationStepId,
  type ActivationWizardValues,
  type PortalCredentials,
} from '../activation-wizard-model';
import { useSequentialRun } from '../use-sequential-run';
import { ChoosePropertyFirst } from './choose-property-first';

/** At least 44 px high on every device, and a long label wraps instead of pushing the page sideways. */
const TOUCH_TARGET = 'h-auto min-h-11 whitespace-normal py-2 text-center leading-tight';

type RowState = 'queued' | 'running' | 'done' | 'needsAccess' | 'failed';

/** The words of each state; the keys are written out so that the test of the locale files finds a missing translation. */
const STATE_TEXT: Readonly<Record<RowState, string>> = {
  queued: 'marketplace.activation.connection.state.queued',
  running: 'marketplace.activation.connection.state.running',
  done: 'marketplace.activation.connection.state.done',
  needsAccess: 'marketplace.activation.connection.state.needsAccess',
  failed: 'marketplace.activation.connection.state.failed',
};

const ROW_ICON = { queued: Circle, running: Loader2, done: CheckCircle2, needsAccess: AlertTriangle, failed: AlertTriangle } as const;

interface ConnectionStepProps {
  context: ActivationContext;
  /** The username and the password of the portal, from the state of the page: they are used here, once for each property, and forgotten when every one is connected. */
  credentials: PortalCredentials;
  /** Every chosen property is connected: the page forgets the access data. */
  onCredentialsUsed: () => void;
  /** Opens the step where the person can change what is wrong (the access, the properties). */
  onFix: (step: ActivationStepId) => void;
  /** Goes on to the import: every chosen property is connected. */
  onAdvance: () => void;
  onChoose: () => void;
}

/**
 * Step «Collegamento» (E09/F02/US04/T02, MKT-03): it creates the connection on the channel manager for each chosen property, one after the other
 * (`POST /api/marketplace/activations`), and says in plain words how far it is. It starts by itself, once for each property, and never creates a second connection:
 * a property that already has its activation (a resume, a second pass through the wizard) is read from the server and is only shown. What the channel refuses is told
 * as «the channel refused the connection», with the reason it gave and the way back to the access step; it is never told as an error of CasaZen, and a refusal for one
 * property does not stop the others.
 *
 * The step goes on by itself when this visit made the connections and every one is there; a visit that finds them made shows them and leaves «Continua» to the person.
 */
export function ConnectionStep({ context, credentials, onCredentialsUsed, onFix, onAdvance, onChoose }: ConnectionStepProps) {
  const { t } = useTranslation();
  const { control } = useFormContext<ActivationWizardValues>();
  const propertyIds = useWatch({ control, name: 'propertyIds' }) ?? [];
  const hotelIds = useWatch({ control, name: 'hotelIds' }) ?? {};
  const start = useStartActivation();
  const { kind, code, requirements, plans } = context;
  const name = context.channelName ?? t('marketplace.activation.thisChannel');

  const activationIds = propertyIds.map((propertyId) => plans.get(propertyId)?.activationId ?? null);
  const states = useActivations(activationIds);
  const connectedAt = (index: number) => states[index]?.data?.connectionFound === true && states[index]?.data?.status !== 'Deactivated';
  const lacksAccess = (propertyId: string) =>
    requirements !== null && !isAccessComplete(missingAccess(requirements, [propertyId], hotelIds, credentials));

  // Nothing starts before the plan of each chosen property was read, and the state of the activations that exist.
  const ready = requirements !== null && propertyIds.every((propertyId, index) => plans.has(propertyId) && (activationIds[index] === null || !states[index].isPending));

  const { running, failures, retry, ran } = useSequentialRun({
    ids: propertyIds,
    ready,
    isDone: (propertyId) => connectedAt(propertyIds.indexOf(propertyId)) || lacksAccess(propertyId),
    run: async (propertyId) => {
      if (!requirements) return;
      // The access data goes in this one call; the mutation is reset at once, so the request is not kept in memory longer than the call.
      try {
        await start.mutateAsync(startRequestFor(kind, code, propertyId, requirements, hotelIds, credentials));
      } finally {
        start.reset();
      }
    },
  });

  const allConnected = propertyIds.length > 0 && propertyIds.every((_, index) => connectedAt(index));
  const working = running !== null;
  // Goes on by itself once, when this visit made the connections and every one is there.
  const advanced = useRef(false);
  useEffect(() => {
    if (working || !ran || !allConnected || advanced.current) return;
    advanced.current = true;
    onAdvance();
  }, [working, ran, allConnected, onAdvance]);
  useEffect(() => {
    if (allConnected) onCredentialsUsed();
  }, [allConnected, onCredentialsUsed]);

  if (propertyIds.length === 0) return <ChoosePropertyFirst onChoose={onChoose} />;
  // A property whose plan could not be read cannot be connected: the step says so instead of waiting for it.
  if (!context.plansPending && propertyIds.some((propertyId) => !plans.has(propertyId))) {
    return (
      <Alert
        variant="danger"
        data-testid="activation-connection-plan-error"
        action={
          <Button type="button" size="sm" variant="outline" className={TOUCH_TARGET} onClick={context.onRetry}>
            {t('marketplace.activation.connection.retry')}
          </Button>
        }
      >
        {t('marketplace.activation.connection.planError')}
      </Alert>
    );
  }

  const stateOf = (propertyId: string, index: number): RowState => {
    if (connectedAt(index)) return 'done';
    if (failures.has(propertyId)) return 'failed';
    if (running === propertyId) return 'running';
    return lacksAccess(propertyId) ? 'needsAccess' : 'queued';
  };

  return (
    <div className="flex flex-col gap-4" data-testid="activation-connection-step">
      <p className="text-sm text-muted-foreground">{t('marketplace.activation.connection.intro', { name })}</p>
      <ul className="space-y-3" role="list" data-testid="activation-connection-list">
        {propertyIds.map((propertyId, index) => {
          const state = stateOf(propertyId, index);
          const Icon = ROW_ICON[state];
          const error = failures.get(propertyId);
          const code = problemCodeOf(error);
          const refused = code === CHANNEL_REFUSAL_CODE;
          const fixAt = state === 'needsAccess' ? ACTIVATION_STEP.access : stepToFix(code);
          const canFix = fixAt === ACTIVATION_STEP.access || fixAt === ACTIVATION_STEP.property;
          const reason = state === 'failed' ? (translateErrorCode(code, t) ?? getProblemMessage(error, t) ?? t('marketplace.activation.connection.failed.generic')) : null;

          return (
            <li key={propertyId} className="min-w-0 space-y-2 rounded-lg border p-4" data-testid={`activation-connection-${propertyId}`} data-state={state}>
              <div className="flex min-w-0 items-center gap-2">
                <Icon
                  aria-hidden="true"
                  className={state === 'running' ? 'size-4 shrink-0 animate-spin motion-reduce:animate-none' : 'size-4 shrink-0'}
                />
                <p className="min-w-0 break-words font-medium">{propertyNameOf(context.properties, propertyId) ?? propertyId}</p>
                <span className="ml-auto shrink-0 text-sm text-muted-foreground">{t(STATE_TEXT[state])}</span>
              </div>

              {state === 'failed' ? (
                <div className="space-y-2" role="alert" data-testid={`activation-connection-${propertyId}-problem`}>
                  {refused ? <p className="font-medium">{t('marketplace.activation.connection.failed.refused', { name })}</p> : null}
                  <p className="text-sm">{reason}</p>
                </div>
              ) : null}
              {state === 'needsAccess' ? <p className="text-sm">{t('marketplace.activation.connection.needsAccess')}</p> : null}

              {state === 'failed' || state === 'needsAccess' ? (
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  {canFix ? (
                    <Button type="button" size="sm" className={TOUCH_TARGET} onClick={() => onFix(fixAt)} data-testid={`activation-connection-${propertyId}-fix`}>
                      {t(fixAt === ACTIVATION_STEP.property ? 'marketplace.activation.connection.fixProperty' : 'marketplace.activation.connection.fix')}
                    </Button>
                  ) : null}
                  {state === 'failed' && !refused ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className={TOUCH_TARGET}
                      onClick={() => retry(propertyId)}
                      data-testid={`activation-connection-${propertyId}-retry`}
                    >
                      {t('marketplace.activation.connection.retry')}
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
      <p className="sr-only" aria-live="polite">
        {working ? t('marketplace.activation.connection.working') : ''}
      </p>
    </div>
  );
}
