import { useState } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Landmark, RefreshCw, Send } from 'lucide-react';
import { StatusBadge } from '@/components/shared/status/status-badge';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { getProblemMessage } from '@/lib/api-errors';
import { isValidCin } from '@/lib/cin-format';
import { useListingStatus, usePublishListing, type AdoptedTexts } from '@/queries/use-listing-status';
import { useProperty } from '@/queries/use-properties';
import { useChannelName } from '../../components/channel-name';
import { OutsideChangeDialog } from '../../components/outside-change-dialog';
import {
  OCTORATE_MAPPING_PATH,
  channelEntries,
  missingStepsOf,
  publishProblemOf,
  selectedChannels,
  type ChannelEntry,
  type PublishProblem,
} from '../channels-model';
import type { PropertyWizardValues, WizardStepId } from '../property-wizard-model';

interface ChannelsStepProps {
  form: UseFormReturn<PropertyWizardValues>;
  propertyId: string;
  /** Opens a step of the wizard: the «Correggi» of a channel goes to the step that lacks data. */
  goTo: (stepId: string) => void;
  /** The host took the descriptions of the channel manager: the wizard starts the fields of its form from what the server holds now. */
  onAdopted?: (adopted: AdoptedTexts) => void;
}

/** The texts a refused publication says are missing, by their code (`en.title`): the words the host knows them by. */
const KNOWN_TEXTS = new Set(['it.title', 'it.description', 'en.title', 'en.description']);

/**
 * Step 7 · «Pubblica sui canali» (E02/F03/US01/T04, NF-09, NF-27, NF-29, NF-30, NF-38): for each channel its name, its state in words with
 * a colour and an icon, how complete the listing is for it, the reason in simple words and the steps that lack data, each with «Correggi».
 * The channels that receive content are chosen with a checkbox; one managed on the channel itself only says so. A line says where the CIN
 * is not sent yet («il CIN resta in CasaZen»), and «Lo inserisco dopo» lets the host go on without one (the server then leaves only the
 * channels that ask for it to fix, and raises the To do). «Pubblica» shows each channel's result as it arrives, and an error on one
 * channel does not hide the others. What a refusal says is answered here: the dialog of a change made outside CasaZen, the list of the
 * texts that are missing, the way to the mapping of the listing.
 */
export function ChannelsStep({ form, propertyId, goTo, onAdopted }: ChannelsStepProps) {
  const { t } = useTranslation();
  const channelName = useChannelName();
  const status = useListingStatus(propertyId);
  const property = useProperty(propertyId);
  const publish = usePublishListing(propertyId);
  const leftOut = form.watch('skipChannels');
  const [cinLater, setCinLater] = useState(false);
  const [started, setStarted] = useState(false);
  const [problem, setProblem] = useState<PublishProblem | null>(null);
  const [outsideOpen, setOutsideOpen] = useState(false);

  const entries = channelEntries(status.data);
  const selected = selectedChannels(entries, leftOut);
  const cinValid = isValidCin(property.data?.cinCode);
  const cinWaits = !cinValid && !cinLater;
  const outsideRows = (status.data?.channels ?? []).filter((row) => row.changedOutside.length > 0);
  // The CIN stays in CasaZen whatever the channel: the ones that receive content and have no row yet are included.
  const cinStaysFor = [
    ...new Set([...(status.data?.cinNotSentTo ?? []), ...entries.filter((entry) => entry.selectable).map((entry) => entry.code)]),
  ];

  const toggle = (code: string, checked: boolean) =>
    form.setValue('skipChannels', checked ? leftOut.filter((other) => other !== code) : [...leftOut, code], { shouldDirty: true });

  const publishNow = async () => {
    setProblem(null);
    setStarted(false);
    try {
      await publish.mutateAsync({ channels: selected, overwrite: false });
      setStarted(true);
    } catch (error) {
      const found = publishProblemOf(error);
      setProblem(found);
      if (found.kind === 'modified-outside') setOutsideOpen(true);
    }
  };

  return (
    <>
      <p className="text-sm text-foreground/70">{t('propertyWizard.channels.intro')}</p>

      {status.isLoading ? (
        <div className="space-y-3" role="status" aria-busy="true" aria-label={t('propertyWizard.channels.loading')}>
          {[0, 1, 2].map((slot) => (
            <Skeleton key={slot} className="h-24 w-full" />
          ))}
        </div>
      ) : status.isError ? (
        <Alert
          variant="danger"
          data-testid="property-wizard-channels-error"
          action={
            <Button type="button" size="sm" variant="outline" onClick={() => void status.refetch()}>
              {t('propertyWizard.page.retry')}
            </Button>
          }
        >
          {getProblemMessage(status.error, t) ?? t('propertyWizard.channels.loadFailed')}
        </Alert>
      ) : (
        <ul className="space-y-4" data-testid="property-wizard-channels">
          {entries.map((entry) => (
            <ChannelCard
              key={entry.code}
              entry={entry}
              name={channelName(entry.code)}
              chosen={!leftOut.includes(entry.code)}
              onChoose={(checked) => toggle(entry.code, checked)}
              goTo={goTo}
            />
          ))}
        </ul>
      )}

      <p className="flex items-start gap-2 text-sm text-foreground/70" data-testid="property-wizard-channels-cin-line">
        <Landmark aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        <span>{t('propertyWizard.channels.cin.stays', { channels: cinStaysFor.map(channelName).join(', ') })}</span>
      </p>

      {!cinValid ? (
        <Alert
          variant="warning"
          data-testid="property-wizard-channels-cin"
          action={
            <Button
              type="button"
              size="sm"
              variant={cinLater ? 'default' : 'outline'}
              aria-pressed={cinLater}
              onClick={() => setCinLater((current) => !current)}
              data-testid="property-wizard-cin-later"
            >
              {t('propertyWizard.channels.cin.later')}
            </Button>
          }
        >
          {cinLater ? t('propertyWizard.channels.cin.laterChosen') : t('propertyWizard.channels.cin.missing')}
        </Alert>
      ) : null}

      {outsideRows.length > 0 ? (
        // A channel somebody changed outside CasaZen is told here, before «Pubblica» (the To do of the change leads to this step), with the
        // way to the choice: nothing is overwritten without it, and the host does not have to be refused first to find it.
        <Alert
          variant="warning"
          data-testid="property-wizard-channels-outside"
          action={
            <Button type="button" size="sm" variant="outline" onClick={() => setOutsideOpen(true)} data-testid="property-wizard-channels-outside-choose">
              {t('propertyWizard.channels.outside.choose')}
            </Button>
          }
        >
          {t('propertyWizard.channels.outside.text')}
        </Alert>
      ) : null}

      <PublishProblemAlert problem={problem} goTo={goTo} />

      {started ? (
        <p role="status" className="flex items-center gap-2 text-sm" data-testid="property-wizard-channels-started">
          <RefreshCw aria-hidden="true" className="size-4 shrink-0" />
          {t('propertyWizard.channels.started')}
        </p>
      ) : null}

      <div className="space-y-2">
        <Button
          type="button"
          loading={publish.isPending}
          disabled={selected.length === 0 || cinWaits}
          onClick={() => void publishNow()}
          data-testid="property-wizard-publish"
        >
          <Send aria-hidden="true" className="size-4" />
          {t('propertyWizard.channels.publish')}
        </Button>
        {selected.length === 0 ? (
          <p className="text-sm text-foreground/70">{t('propertyWizard.channels.noneChosen')}</p>
        ) : cinWaits ? (
          <p className="text-sm text-foreground/70">{t('propertyWizard.channels.cin.choose')}</p>
        ) : null}
      </div>

      <OutsideChangeDialog open={outsideOpen} onOpenChange={setOutsideOpen} propertyId={propertyId} rows={outsideRows} onAdopted={onAdopted} />
    </>
  );
}

interface ChannelCardProps {
  entry: ChannelEntry;
  name: string;
  chosen: boolean;
  onChoose: (chosen: boolean) => void;
  goTo: (stepId: string) => void;
}

/** One channel: its name and state, what it takes to be published, and the way to the steps that lack data. */
function ChannelCard({ entry, name, chosen, onChoose, goTo }: ChannelCardProps) {
  const { t } = useTranslation();
  const { row } = entry;
  const missing = row ? missingStepsOf(row) : [];

  return (
    <li className="min-w-0 space-y-3 rounded-lg p-4 ring-1 ring-inset ring-border" data-testid={`property-wizard-channel-${entry.code}`} data-status={row?.status ?? 'Draft'}>
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
        {entry.selectable ? (
          <label className="flex min-h-11 min-w-0 cursor-pointer items-center gap-3 font-medium">
            <Checkbox checked={chosen} onCheckedChange={(next) => onChoose(next === true)} data-testid={`property-wizard-channel-choose-${entry.code}`} />
            <span className="min-w-0 break-words">{t('propertyWizard.channels.publishOn', { channel: name })}</span>
          </label>
        ) : (
          <span className="min-w-0 break-words font-medium">{name}</span>
        )}
        <StatusBadge kind="channel" status={row?.status ?? 'Draft'} />
      </div>

      {entry.managed ? (
        // The content of this channel is edited on the channel itself: CasaZen sends nothing to it and says so (NF-27).
        <p className="text-sm text-foreground/70" data-testid={`property-wizard-channel-managed-${entry.code}`}>
          {t('propertyWizard.channels.managed', { channel: name })}
        </p>
      ) : row ? (
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <Progress
              value={row.completeness}
              size="sm"
              tone={row.completeness >= 100 ? 'success' : 'default'}
              label={t('propertyWizard.channels.completeness', { value: row.completeness })}
            />
            <span className="shrink-0 text-sm tabular-nums text-foreground/70">{row.completeness}%</span>
          </div>
          {row.reason ? (
            <p className="text-sm" data-testid={`property-wizard-channel-reason-${entry.code}`}>
              {row.reason}
              {row.reasonDetail ? <span className="block text-foreground/70">{row.reasonDetail}</span> : null}
            </p>
          ) : null}
          {row.syncAlert ? <p className="text-sm text-warning-foreground">{t('propertyWizard.channels.syncAlert')}</p> : null}
        </div>
      ) : (
        <p className="text-sm text-foreground/70">{t('propertyWizard.channels.notPublished')}</p>
      )}

      {missing.length > 0 ? (
        <div className="space-y-2">
          <p className="text-sm font-medium">{t('propertyWizard.channels.lacks')}</p>
          <div className="flex flex-wrap gap-2">
            {missing.map((step: WizardStepId) => (
              <Button key={step} type="button" size="sm" variant="outline" onClick={() => goTo(step)} data-testid={`property-wizard-fix-${entry.code}-${step}`}>
                {t('propertyWizard.channels.fix', { step: t(`propertyWizard.steps.${step}.label`) })}
              </Button>
            ))}
          </div>
        </div>
      ) : null}
    </li>
  );
}

interface PublishProblemAlertProps {
  problem: PublishProblem | null;
  goTo: (stepId: string) => void;
}

/** What a refused publication says, answered where the host is looking. */
function PublishProblemAlert({ problem, goTo }: PublishProblemAlertProps) {
  const { t } = useTranslation();
  if (!problem) return null;

  switch (problem.kind) {
    case 'content-incomplete':
      return (
        <Alert
          variant="danger"
          title={t('propertyWizard.channels.incomplete.title')}
          data-testid="property-wizard-channels-incomplete"
          action={
            <Button type="button" size="sm" variant="outline" onClick={() => goTo('descriptions')} data-testid="property-wizard-fix-texts">
              {t('propertyWizard.channels.fix', { step: t('propertyWizard.steps.descriptions.label') })}
            </Button>
          }
        >
          <ul className="list-disc space-y-0.5 pl-5">
            {problem.missing.map((code) => (
              <li key={code}>{KNOWN_TEXTS.has(code) ? t(`listingStatus.missingText.${code.replace('.', '_')}`) : code}</li>
            ))}
          </ul>
        </Alert>
      );
    case 'mapping-unconfirmed':
    case 'must-import':
      return (
        <Alert
          variant="warning"
          data-testid="property-wizard-channels-mapping"
          action={
            <Button asChild size="sm" variant="outline">
              <Link to={OCTORATE_MAPPING_PATH}>{t('propertyWizard.channels.mapping.go')}</Link>
            </Button>
          }
        >
          {problem.kind === 'mapping-unconfirmed' ? t('propertyWizard.channels.mapping.unconfirmed') : t('propertyWizard.channels.mapping.mustImport')}
        </Alert>
      );
    case 'modified-outside':
      // Said by the alert above (the status lists the channels that changed) and answered in the dialog, which the refusal has just opened.
      return null;
    default:
      return (
        <Alert variant="danger" data-testid="property-wizard-channels-publish-error">
          {getProblemMessage(problem.error, t) ?? t('propertyWizard.channels.publishFailed')}
        </Alert>
      );
  }
}
