import { useEffect, useRef } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, CheckCircle2, Circle, Clock, Loader2 } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { getProblemMessage, translateErrorCode } from '@/lib/api-errors';
import { isImportRequested, useActivationMappings, useImportActivation } from '@/queries/use-marketplace';
import {
  ACTIVATION_STEP,
  IMPORT_ITEMS,
  importItemState,
  problemCodeOf,
  propertyNameOf,
  stepToFix,
  type ActivationContext,
  type ActivationStepId,
  type ActivationWizardValues,
  type ImportItemState,
} from '../activation-wizard-model';
import { useSequentialRun } from '../use-sequential-run';
import { ChoosePropertyFirst } from './choose-property-first';

/** At least 44 px high on every device, and a long label wraps instead of pushing the page sideways. */
const TOUCH_TARGET = 'h-auto min-h-11 whitespace-normal py-2 text-center leading-tight';

const ITEM_TEXT: Readonly<Record<ImportItemState, string>> = {
  queued: 'marketplace.activation.import.state.queued',
  starting: 'marketplace.activation.import.state.starting',
  requested: 'marketplace.activation.import.state.requested',
  waiting: 'marketplace.activation.import.state.waiting',
  done: 'marketplace.activation.import.state.done',
};

/** The three imports, with their words. */
const ITEM_NAME_TEXT = {
  rooms: 'marketplace.activation.import.items.rooms',
  reservations: 'marketplace.activation.import.items.reservations',
  calendar: 'marketplace.activation.import.items.calendar',
} as const;

const ITEM_ICON: Readonly<Record<ImportItemState, typeof Circle>> = { queued: Circle, starting: Loader2, requested: Clock, waiting: Loader2, done: CheckCircle2 };

interface ImportStepProps {
  context: ActivationContext;
  /** Opens the step where the person can change what is wrong (the connection, the access). */
  onFix: (step: ActivationStepId) => void;
  /** Goes on to the mapping: the rooms of every chosen property are in. */
  onAdvance: () => void;
  onChoose: () => void;
}

/**
 * Step «Importazione» (E09/F02/US04/T02, MKT-03, LST-02): CasaZen asks the channel manager to import the rooms, the reservations and the calendar of the channel
 * (`POST /api/marketplace/activations/{id}/import`) for each chosen property, one after the other, and shows where each stands. The channel manager does it on its
 * own and the server cannot be asked how far the reservations and the calendar are: only the rooms can be seen to arrive (the mapping read gives them), so only the rooms
 * are shown as done; the other two are shown as asked, never as finished. It starts by itself, once for each activation in this session, and it goes on by itself when
 * the rooms of every property are in and this visit saw the work.
 *
 * It says how long it may take and that the person can leave with «Salva ed esci»: the import goes on in the channel manager.
 */
export function ImportStep({ context, onFix, onAdvance, onChoose }: ImportStepProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { control } = useFormContext<ActivationWizardValues>();
  const propertyIds = useWatch({ control, name: 'propertyIds' }) ?? [];
  const asking = useImportActivation();
  const { plans } = context;
  const name = context.channelName ?? t('marketplace.activation.thisChannel');

  const activationIds = propertyIds.map((propertyId) => plans.get(propertyId)?.activationId ?? null);
  const requestedAt = (index: number) => activationIds[index] !== null && isImportRequested(queryClient, activationIds[index] ?? '');
  // The rooms are read once the import was asked, and again until they are there.
  const mappings = useActivationMappings(
    activationIds.map((id, index) => ({ id, enabled: requestedAt(index) })),
    { pollUntilRooms: true },
  );
  const roomsInAt = (index: number) => (mappings[index]?.data?.channelRooms.length ?? 0) > 0;

  const ready = propertyIds.every((propertyId) => plans.has(propertyId));
  const { running, failures, retry, ran } = useSequentialRun({
    ids: propertyIds,
    ready,
    isDone: (propertyId) => {
      const index = propertyIds.indexOf(propertyId);
      return activationIds[index] === null || requestedAt(index);
    },
    run: async (propertyId) => {
      const activationId = plans.get(propertyId)?.activationId;
      if (activationId) await asking.mutateAsync(activationId);
    },
  });

  const allRoomsIn = propertyIds.length > 0 && propertyIds.every((_, index) => roomsInAt(index));
  const working = running !== null || propertyIds.some((_, index) => requestedAt(index) && !roomsInAt(index));
  // The rooms are in and this visit asked for the import: the wizard goes on by itself, once. A visit that finds them there leaves the button to the person.
  const advanced = useRef(false);
  useEffect(() => {
    if (running !== null || !ran || !allRoomsIn || advanced.current) return;
    advanced.current = true;
    onAdvance();
  }, [running, ran, allRoomsIn, onAdvance]);

  if (propertyIds.length === 0) return <ChoosePropertyFirst onChoose={onChoose} />;

  return (
    <div className="flex flex-col gap-4" data-testid="activation-import-step">
      <p className="text-sm text-muted-foreground">{t('marketplace.activation.import.intro', { name })}</p>
      <p className="text-sm text-muted-foreground" data-testid="activation-import-leave">
        {t('marketplace.activation.import.leave')}
      </p>

      <ul className="space-y-3" role="list" data-testid="activation-import-list">
        {propertyIds.map((propertyId, index) => {
          const activationId = activationIds[index];
          // A plan that is still being read says nothing yet: it is not «no connection».
          if (!plans.has(propertyId)) {
            return (
              <li key={propertyId} className="min-w-0 space-y-2 rounded-lg border p-4" data-testid={`activation-import-${propertyId}`} data-rooms="not-yet" aria-busy="true">
                <p className="break-words font-medium">{propertyNameOf(context.properties, propertyId) ?? propertyId}</p>
                <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
                  <Loader2 aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" />
                  {t('marketplace.activation.import.reading')}
                </p>
              </li>
            );
          }
          const requested = requestedAt(index);
          const roomsIn = roomsInAt(index);
          const importError = failures.get(propertyId);
          const readError = requested && mappings[index]?.isError && !roomsIn ? mappings[index].error : null;
          const error = importError ?? readError;
          const code = problemCodeOf(error);
          const fixAt = activationId === null ? ACTIVATION_STEP.connection : stepToFix(code);
          const canFix = fixAt === ACTIVATION_STEP.access || fixAt === ACTIVATION_STEP.connection || fixAt === ACTIVATION_STEP.property;
          const problem =
            activationId === null
              ? t('marketplace.activation.import.noConnection')
              : error
                ? (translateErrorCode(code, t) ?? getProblemMessage(error, t) ?? t(importError ? 'marketplace.activation.import.failed' : 'marketplace.activation.import.readError'))
                : null;

          // Only the rooms can be seen to arrive: the reservations and the calendar are asked, and arrive on their own.
          const items = IMPORT_ITEMS.map((id) => ({ id, state: importItemState(id, { starting: running === propertyId, requested, roomsIn }) }));

          return (
            <li key={propertyId} className="min-w-0 space-y-3 rounded-lg border p-4" data-testid={`activation-import-${propertyId}`} data-rooms={roomsIn ? 'in' : 'not-yet'}>
              <p className="break-words font-medium">{propertyNameOf(context.properties, propertyId) ?? propertyId}</p>
              <ul className="space-y-1.5" role="list">
                {items.map(({ id, state }) => {
                  const Icon = ITEM_ICON[state];
                  return (
                    <li key={id} className="flex items-center gap-2 text-sm" data-item={id} data-state={state}>
                      <Icon aria-hidden="true" className={state === 'starting' || state === 'waiting' ? 'size-4 shrink-0 animate-spin motion-reduce:animate-none' : 'size-4 shrink-0'} />
                      <span className="min-w-0 break-words">
                        {t(ITEM_NAME_TEXT[id])}: {t(ITEM_TEXT[state])}
                      </span>
                    </li>
                  );
                })}
              </ul>

              {problem ? (
                <div className="space-y-2" role="alert" data-testid={`activation-import-${propertyId}-problem`}>
                  <p className="flex items-start gap-2 text-sm">
                    <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                    <span className="min-w-0 break-words">{problem}</span>
                  </p>
                  <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                    {canFix ? (
                      <Button type="button" size="sm" className={TOUCH_TARGET} onClick={() => onFix(fixAt)} data-testid={`activation-import-${propertyId}-fix`}>
                        {t(fixAt === ACTIVATION_STEP.access ? 'marketplace.activation.import.fixAccess' : fixAt === ACTIVATION_STEP.property ? 'marketplace.activation.import.fixProperty' : 'marketplace.activation.import.fixConnection')}
                      </Button>
                    ) : null}
                    {activationId !== null ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className={TOUCH_TARGET}
                        onClick={() => (importError ? retry(propertyId) : void mappings[index].refetch())}
                        data-testid={`activation-import-${propertyId}-retry`}
                      >
                        {t('marketplace.activation.import.retry')}
                      </Button>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>

      {allRoomsIn ? (
        <Alert variant="success" data-testid="activation-import-done">
          {t('marketplace.activation.import.allIn')}
        </Alert>
      ) : null}
      <p className="sr-only" aria-live="polite">
        {working ? t('marketplace.activation.import.working') : ''}
      </p>
    </div>
  );
}
