import { useEffect, useRef, useState } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { ExternalLink } from 'lucide-react';
import { splitMainChannels } from '@/features/marketplace/lib/main-channels';
import { AssistRequestButton } from '@/features/onboarding/components/assist-request-button';
import { useExternalHandoff } from '@/features/onboarding/use-external-handoff';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChoiceCard, ChoiceGroup } from '@/components/ui/choice-card';
import { getProblemMessage, translateErrorCode } from '@/lib/api-errors';
import { cn } from '@/lib/utils';
import {
  useConfirmChannelAccess,
  useCreateExistingInventoryBatch,
  useExistingInventoryBatch,
  useOtaChannelChoices,
  useStartChannelAccess,
} from '@/queries/use-existing-inventory-import';
import type { ExistingInventoryBatch, ExistingInventoryChannel } from '@/types';
import { batchChannelCodes, channelAccessView, channelOf, isAccessGiven, isWaitingForAccess, type ChannelAccessView } from './existing-inventory';
import type { ConnectWizardValues } from './inventory-scenario';
import { StepProblem } from './listing-parts';

/** At least 44 px high on every device, and a long label wraps instead of pushing the page sideways. */
const TOUCH_TARGET = 'h-auto min-h-11 whitespace-normal py-2 text-center leading-tight';

const VIEW_BADGE: Readonly<Record<ChannelAccessView, 'secondary' | 'warning' | 'success' | 'destructive' | 'outline'>> = {
  notStarted: 'outline',
  waiting: 'secondary',
  verifying: 'secondary',
  connected: 'success',
  needsConfirmation: 'warning',
  error: 'destructive',
};

interface ChannelRowProps {
  code: string;
  name: string;
  channel: ExistingInventoryChannel | undefined;
  /** Makes sure a batch exists that includes every channel chosen (it is created, or created again with the channels added) and gives its id. */
  ensureBatch: () => Promise<string>;
  /** The batch is read again: the explicit trigger of a check of the access (the window closed, the tab came back). */
  onCheck: () => void;
  batchId: string | null;
}

/**
 * One channel of the list: its state in the words of the wizard, the button that opens the panel of the channel manager (the access is given
 * there, never in CasaZen), the confirmation that is offered only after a check that could not tell, and «Fallo per me». The panel opens in a
 * secondary window while this step stays on screen; the step and the point to come back to are stored before it opens.
 */
function ChannelRow({ code, name, channel, ensureBatch, onCheck, batchId }: ChannelRowProps) {
  const { t } = useTranslation();
  const startAccess = useStartChannelAccess();
  const confirmAccess = useConfirmChannelAccess();
  const view = channel ? channelAccessView(channel) : 'notStarted';

  const handoff = useExternalHandoff({
    start: async () => {
      const id = await ensureBatch();
      const started = await startAccess.mutateAsync({ batchId: id, channelCode: code });
      return { handoffMode: started.handoffMode, panelUrl: started.panelUrl, alreadyComplete: started.alreadyComplete };
    },
    onTrigger: onCheck,
    // Also while the answer is «Da confermare»: the checks can run out while the person is still on the panel, and what tells that they are back (the tab
    // coming to the front, the window closing) is what lets the question «Hai completato...?» appear.
    watching: view === 'waiting' || view === 'verifying' || view === 'needsConfirmation',
  });

  const problem = handoff.error ? (getProblemMessage(handoff.error, t) ?? t('octorate.connect.existing.channels.openFailed')) : null;
  const confirmProblem = confirmAccess.isError ? (getProblemMessage(confirmAccess.error, t) ?? t('octorate.connect.existing.channels.confirmFailed')) : null;
  // A channel that stopped says why in the words of the app, the others are not affected.
  const stopped = channel?.errorCode ? (translateErrorCode(channel.errorCode, t) ?? t('octorate.connect.existing.errors.unknown')) : null;
  const askConfirmation = view === 'needsConfirmation' && (handoff.ended || !handoff.launched);

  return (
    <li className="min-w-0 space-y-3 rounded-lg border p-4" data-testid={`existing-channel-${code}`} data-state={view}>
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
        <p className="min-w-0 break-words font-medium">{name}</p>
        <Badge variant={VIEW_BADGE[view]} className="whitespace-nowrap" data-testid={`existing-channel-${code}-state`}>
          {t(`octorate.connect.existing.channels.state.${view}`)}
        </Badge>
      </div>

      {view === 'connected' ? null : (
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Button
            type="button"
            variant={view === 'notStarted' || view === 'error' ? 'default' : 'outline'}
            className={TOUCH_TARGET}
            loading={handoff.starting}
            onClick={() => void handoff.open()}
            iconRight={<ExternalLink />}
            data-testid={`existing-channel-${code}-open`}
          >
            {t(view === 'notStarted' ? 'octorate.connect.existing.channels.connect' : 'octorate.connect.existing.channels.reopen')}
          </Button>
          <AssistRequestButton part="channels" context="panelChannelAccess" channelCode={code} />
        </div>
      )}

      {handoff.blocked ? (
        <Alert variant="warning" data-testid={`existing-channel-${code}-blocked`}>
          {t('octorate.connect.existing.channels.blocked')}
        </Alert>
      ) : null}
      {view === 'waiting' || view === 'verifying' ? (
        <p className="text-sm text-muted-foreground" role="status" data-testid={`existing-channel-${code}-waiting`}>
          {t('octorate.connect.existing.channels.waiting')}
        </p>
      ) : null}

      {askConfirmation ? (
        <div className="space-y-2 rounded-md bg-muted p-3 text-sm" data-testid={`existing-channel-${code}-confirm-box`}>
          <p className="font-medium">{t('octorate.connect.existing.channels.confirmQuestion')}</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              size="sm"
              className={TOUCH_TARGET}
              loading={confirmAccess.isPending}
              disabled={!batchId}
              onClick={() => batchId && confirmAccess.mutate({ batchId, channelCode: code })}
              data-testid={`existing-channel-${code}-confirm`}
            >
              {t('octorate.connect.existing.channels.confirmYes')}
            </Button>
            <Button type="button" size="sm" variant="outline" className={TOUCH_TARGET} onClick={() => void handoff.open()} data-testid={`existing-channel-${code}-no`}>
              {t('octorate.connect.existing.channels.confirmNo')}
            </Button>
          </div>
        </div>
      ) : null}

      {view === 'error' ? (
        <p className="text-sm text-danger-foreground" role="alert" data-testid={`existing-channel-${code}-error`}>
          {stopped ?? t('octorate.connect.existing.channels.notValid')}
        </p>
      ) : null}
      {problem ? (
        <p className="text-sm text-danger-foreground" role="alert" data-testid={`existing-channel-${code}-problem`}>
          {problem}
        </p>
      ) : null}
      {confirmProblem ? (
        <p className="text-sm text-danger-foreground" role="alert" data-testid={`existing-channel-${code}-confirm-problem`}>
          {confirmProblem}
        </p>
      ) : null}
    </li>
  );
}

interface ExistingChannelsStepProps {
  /** The group of a mixed portfolio the import is about; none is the whole inventory. */
  group?: string;
  /** Goes on to the import: every channel chosen has its access, which CasaZen saw by itself. */
  onAdvance: () => void;
}

/**
 * Step «Collega i canali» of the road `onOtas` (E02/F01/US03/T02, D6): the host chooses the OTAs where the listings are today, and for each one
 * gives CasaZen's channel manager the access on its panel. CasaZen owns the handoff: the step is stored before the panel opens, the panel
 * opens in a controlled window while this step stays visible, the result is read at the pace the server asks for, and when every channel has
 * its access the wizard goes on by itself. «Da confermare» appears only after a check that could not tell. Credentials are given on the panel of
 * the channel manager or the OTA, never here: there is no field for them in this wizard.
 */
export function ExistingChannelsStep({ group, onAdvance }: ExistingChannelsStepProps) {
  const { t } = useTranslation();
  const { control, setValue, getValues } = useFormContext<ConnectWizardValues>();
  const selected = useWatch({ control, name: 'channels' }) ?? [];
  const batchId = useWatch({ control, name: 'batchId' }) ?? null;
  const catalog = useOtaChannelChoices();
  const batch = useExistingInventoryBatch(batchId, { poll: isWaitingForAccess });
  const createBatch = useCreateExistingInventoryBatch();
  const { refetch } = batch;

  const nameOf = (code: string) => catalog.choices.find((choice) => choice.code === code)?.name ?? code;

  // The main portals at once, the others behind «Visualizza altri»: a portal already chosen is never hidden.
  const [showAll, setShowAll] = useState(false);
  const split = splitMainChannels(catalog.choices, (choice) => selected.includes(choice.code));
  const shown = showAll ? [...split.main, ...split.others] : split.main;

  const ensureBatch = async (): Promise<string> => {
    const wanted = getValues('channels');
    const existing = getValues('batchId');
    let current: ExistingInventoryBatch | undefined = batch.data;
    if (existing && !current) current = (await refetch()).data;
    // The batch has every channel chosen: it is used as it is. Otherwise a new one is made for all of them: the access already given is kept.
    if (existing && current && wanted.every((code) => batchChannelCodes(current).includes(code))) return existing;
    const created = await createBatch.mutateAsync({ channels: wanted, ...(group ? { group } : {}) });
    setValue('batchId', created.id, { shouldDirty: true });
    return created.id;
  };

  const toggle = (code: string) => {
    const current = getValues('channels');
    setValue('channels', current.includes(code) ? current.filter((candidate) => candidate !== code) : [...current, code], { shouldDirty: true });
  };

  // When the last channel has its access (seen by CasaZen or confirmed), the wizard goes on by itself: only if this visit saw one still waiting.
  const given = (code: string) => {
    const channel = channelOf(batch.data, code);
    return channel ? isAccessGiven(channel) : false;
  };
  const allGiven = selected.length > 0 && selected.every(given);
  const judged = selected.length > 0 && (!batchId || batch.data !== undefined);
  const sawPending = useRef(false);
  useEffect(() => {
    if (!judged) return;
    if (!allGiven) {
      sawPending.current = true;
      return;
    }
    if (!sawPending.current) return;
    sawPending.current = false;
    onAdvance();
  }, [judged, allGiven, onAdvance]);

  return (
    <div className="flex flex-col gap-4" data-testid="existing-channels-step">
      {catalog.isError ? (
        <StepProblem title={t('octorate.connect.existing.channels.loadFailed')} error={catalog.error} onRetry={() => void catalog.refetch()} testId="existing-channels-load-error" />
      ) : (
        <>
          <ChoiceGroup legend={t('octorate.connect.existing.channels.legend')} minCardWidth={12}>
            {shown.map((choice) => (
              <ChoiceCard
                key={choice.code}
                type="checkbox"
                name="existing-channels"
                value={choice.code}
                checked={selected.includes(choice.code)}
                onChange={() => toggle(choice.code)}
                title={choice.name}
                data-testid={`existing-channel-choice-${choice.code}`}
              />
            ))}
          </ChoiceGroup>
          {split.others.length > 0 ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={cn('self-start', TOUCH_TARGET)}
              aria-expanded={showAll}
              onClick={() => setShowAll((value) => !value)}
              data-testid="existing-channels-show-more"
            >
              {showAll
                ? t('octorate.connect.existing.channels.showLess')
                : t('octorate.connect.existing.channels.showMore', { count: split.others.length })}
            </Button>
          ) : null}
        </>
      )}

      <Alert variant="info" data-testid="existing-channels-credentials-note">
        {t('octorate.connect.existing.channels.credentials')}
      </Alert>

      {selected.length === 0 ? (
        <p className={cn('text-sm text-muted-foreground')} data-testid="existing-channels-none">
          {t('octorate.connect.existing.channels.none')}
        </p>
      ) : (
        <ul className="space-y-3" role="list" aria-label={t('octorate.connect.existing.channels.listLabel')} data-testid="existing-channels-list">
          {selected.map((code) => (
            <ChannelRow
              key={code}
              code={code}
              name={nameOf(code)}
              channel={channelOf(batch.data, code)}
              ensureBatch={ensureBatch}
              onCheck={() => void refetch()}
              batchId={batchId}
            />
          ))}
        </ul>
      )}

      {createBatch.isError ? (
        <p className="text-sm text-danger-foreground" role="alert" data-testid="existing-channels-batch-error">
          {getProblemMessage(createBatch.error, t) ?? t('octorate.connect.existing.channels.batchFailed')}
        </p>
      ) : null}
    </div>
  );
}
