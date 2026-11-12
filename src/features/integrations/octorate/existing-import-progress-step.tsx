import { useEffect, useRef } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, CheckCircle2, Circle, Loader2 } from 'lucide-react';
import { AssistRequestButton } from '@/features/onboarding/components/assist-request-button';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { getProblemMessage, translateErrorCode } from '@/lib/api-errors';
import { useExistingInventoryBatch, useOtaChannelChoices, useRunExistingInventory } from '@/queries/use-existing-inventory-import';
import type { ExistingInventoryChannel } from '@/types';
import {
  importSequence,
  isAtMapping,
  isChannelStopped,
  isImporting,
  shouldStartRun,
  unknownResultItems,
  type ImportStepState,
} from './existing-inventory';
import type { ConnectWizardValues } from './inventory-scenario';
import { StepNotice } from './listing-parts';

/** At least 44 px high on every device, and a long label wraps instead of pushing the page sideways. */
const TOUCH_TARGET = 'h-auto min-h-11 whitespace-normal py-2 text-center leading-tight';

const STATE_ICON: Readonly<Record<ImportStepState, typeof Circle>> = { done: CheckCircle2, current: Loader2, pending: Circle, attention: AlertTriangle };

interface ChannelProgressProps {
  channel: ExistingInventoryChannel;
  name: string;
  running: boolean;
  onRetry: (retryUnknown?: readonly string[]) => void;
}

/** One channel: the durable sequence of its import (an icon and a word for each step, never a color alone), its counts, and what to do when it stopped. */
function ChannelProgress({ channel, name, running, onRetry }: ChannelProgressProps) {
  const { t } = useTranslation();
  const sequence = importSequence(channel);
  const stopped = isChannelStopped(channel);
  const unknown = unknownResultItems(channel);
  const why = channel.errorCode ? (translateErrorCode(channel.errorCode, t) ?? t('octorate.connect.existing.errors.unknown')) : null;
  const { counts } = channel;

  return (
    <li className="min-w-0 space-y-3 rounded-lg border p-4" data-testid={`existing-progress-${channel.channelCode}`} data-status={channel.status}>
      <p className="break-words font-medium">{name}</p>
      <ol className="space-y-1.5" aria-label={t('octorate.connect.existing.progress.sequenceLabel', { channel: name })}>
        {sequence.map(({ id, state }) => {
          const Icon = STATE_ICON[state];
          return (
            <li key={id} className="flex items-center gap-2 text-sm" data-step={id} data-state={state}>
              <Icon aria-hidden="true" className={state === 'current' ? 'size-4 shrink-0 animate-spin motion-reduce:animate-none' : 'size-4 shrink-0'} />
              <span className="min-w-0 break-words">{t(`octorate.connect.existing.progress.steps.${id}`)}</span>
              <span className="sr-only">{t(`octorate.connect.existing.progress.state.${state}`)}</span>
            </li>
          );
        })}
      </ol>
      {counts.found > 0 ? (
        <p className="text-sm text-muted-foreground" data-testid={`existing-progress-${channel.channelCode}-counts`}>
          {t('octorate.connect.existing.progress.counts', { found: counts.found, confirmed: counts.confirmed, pending: counts.pending })}
        </p>
      ) : null}

      {stopped ? (
        <div className="space-y-2" data-testid={`existing-progress-${channel.channelCode}-stopped`}>
          <p className="text-sm text-danger-foreground" role="alert">
            {why ?? t('octorate.connect.existing.errors.unknown')}
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Button type="button" size="sm" className={TOUCH_TARGET} disabled={running} onClick={() => onRetry()} data-testid={`existing-progress-${channel.channelCode}-retry`}>
              {t('octorate.connect.existing.progress.retry')}
            </Button>
            {unknown.length > 0 ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className={TOUCH_TARGET}
                disabled={running}
                onClick={() => onRetry(unknown.map((item) => item.octorateAccommodationId))}
                data-testid={`existing-progress-${channel.channelCode}-retry-unknown`}
              >
                {t('octorate.connect.existing.progress.retryUnknown')}
              </Button>
            ) : null}
            <AssistRequestButton part="channels" context="panelChannelAccess" channelCode={channel.channelCode} />
          </div>
        </div>
      ) : null}
    </li>
  );
}

interface ExistingImportProgressStepProps {
  /** Goes on to the mapping: the listings are in and wait for the host to decide. */
  onAdvance: () => void;
}

/**
 * Step «Importazione» of the road `onOtas` (E02/F01/US03/T02, D6): CasaZen starts the import of the batch and shows, channel by channel, the
 * sequence «Annunci e camere», «Abbinamento», «Prenotazioni», «Calendario», «Collegamento completato». It reads the batch again while work
 * runs and stops on a state that waits for someone (the mapping, a channel that stopped, completion); a channel that stopped has «Riprova» and
 * the others are not affected. Completion is shown only when the server says `Completed`. It never creates or publishes anything: the only
 * calls it makes are the batch's own (`run`, and the reads).
 */
export function ExistingImportProgressStep({ onAdvance }: ExistingImportProgressStepProps) {
  const { t } = useTranslation();
  const { control } = useFormContext<ConnectWizardValues>();
  const batchId = useWatch({ control, name: 'batchId' }) ?? null;
  const catalog = useOtaChannelChoices();
  const batch = useExistingInventoryBatch(batchId, { poll: isImporting });
  const run = useRunExistingInventory();
  const { mutate: startRun, isPending: running, isError: runFailed } = run;

  // The import starts by itself once, when a channel has its access and its rooms are not in yet; a channel that stopped is run again by «Riprova».
  // A start that fails (the network, the timeout, 409 `existing_inventory_access_pending`) leaves the channel where it was, which is not «stopped»: it is
  // armed again, but not asked again by itself while the failure stands (it would be asked for ever), and «Riprova» asks it.
  const started = useRef(false);
  useEffect(() => {
    if (!batchId || started.current || running || runFailed || !shouldStartRun(batch.data)) return;
    started.current = true;
    startRun(
      { batchId },
      {
        onError: () => {
          started.current = false;
        },
      },
    );
  }, [batchId, batch.data, running, runFailed, startRun]);
  // What the person asks is not asked again by itself.
  const ask = (retryUnknown?: readonly string[]) => {
    if (!batchId) return;
    started.current = true;
    startRun({ batchId, retryUnknown });
  };

  // Reached the mapping while this visit watched the import: the wizard goes on by itself.
  const sawWorking = useRef(false);
  const atMapping = isAtMapping(batch.data);
  const importing = isImporting(batch.data) || running;
  useEffect(() => {
    if (importing) sawWorking.current = true;
    else if (atMapping && sawWorking.current) {
      sawWorking.current = false;
      onAdvance();
    }
  }, [importing, atMapping, onAdvance]);

  const nameOf = (code: string) => catalog.choices.find((choice) => choice.code === code)?.name ?? code;

  if (!batchId) {
    return <StepNotice title={t('octorate.connect.existing.progress.noBatch.title')} text={t('octorate.connect.existing.progress.noBatch.text')} testId="existing-progress-no-batch" />;
  }

  return (
    <div className="flex flex-col gap-4" data-testid="existing-import-step">
      {batch.isPending ? (
        <div className="flex items-center gap-3 rounded-lg bg-muted p-4 text-sm" role="status" data-testid="existing-progress-loading">
          <Loader2 aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" />
          {t('octorate.connect.existing.progress.loading')}
        </div>
      ) : null}
      {batch.isError ? (
        <Alert variant="danger" data-testid="existing-progress-load-error">
          {getProblemMessage(batch.error, t) ?? t('octorate.connect.existing.progress.loadFailed')}
        </Alert>
      ) : null}
      {run.isError ? (
        <div className="flex flex-col items-start gap-2" data-testid="existing-progress-run-failed">
          <Alert variant="danger" data-testid="existing-progress-run-error">
            {getProblemMessage(run.error, t) ?? t('octorate.connect.existing.errors.unknown')}
          </Alert>
          <Button type="button" size="sm" className={TOUCH_TARGET} onClick={() => ask()} data-testid="existing-progress-run-retry">
            {t('octorate.connect.existing.progress.retry')}
          </Button>
        </div>
      ) : null}

      {batch.data ? (
        <ul className="space-y-3" role="list" data-testid="existing-progress-list">
          {batch.data.channels.map((channel) => (
            <ChannelProgress
              key={channel.channelCode}
              channel={channel}
              name={nameOf(channel.channelCode)}
              running={running}
              onRetry={(retryUnknown) => ask(retryUnknown)}
            />
          ))}
        </ul>
      ) : null}

      {atMapping ? (
        <Alert variant="success" data-testid="existing-progress-at-mapping">
          {t('octorate.connect.existing.progress.atMapping')}
        </Alert>
      ) : null}
      {batch.data?.status === 'Completed' ? (
        <Alert variant="success" data-testid="existing-progress-completed">
          {t('octorate.connect.existing.progress.completed')}
        </Alert>
      ) : null}
      <p className="sr-only" aria-live="polite">
        {importing ? t('octorate.connect.existing.progress.working') : ''}
      </p>
    </div>
  );
}
