import { useId } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PROPERTY_CREATE_PATH } from '@/features/properties/properties-paths';
import { getProblemMessage, translateErrorCode } from '@/lib/api-errors';
import { useContinueExistingInventory, useExistingInventoryBatch, useOtaChannelChoices } from '@/queries/use-existing-inventory-import';
import { isChannelStopped, isImporting } from './existing-inventory';

/** At least 44 px high on every device, and a long label wraps instead of pushing the page sideways. */
const TOUCH_TARGET = 'h-auto min-h-11 whitespace-normal py-2 text-center leading-tight';

interface ExistingImportResultProps {
  batchId: string;
}

/**
 * The result of the import of the listings that already exist on OTAs, channel by channel (E02/F01/US03/T02, D6): how many are linked, how many
 * were left for later, how many failed, and the channel's own state. It says «importati» and «collegati», never «creati» or «pubblicati»: nothing
 * is created or published on the road of the existing listings. A channel that stopped says why and can be asked again; the other channels, and
 * what they already did, are not touched. Whether reviews, ranking and history are kept depends on the migration the OTA itself makes: CasaZen
 * does not promise it.
 */
export function ExistingImportResult({ batchId }: ExistingImportResultProps) {
  const { t } = useTranslation();
  const titleId = useId();
  const batch = useExistingInventoryBatch(batchId, { poll: isImporting });
  const catalog = useOtaChannelChoices();
  const again = useContinueExistingInventory();

  if (!batch.data) return null;
  const nameOf = (code: string) => catalog.choices.find((choice) => choice.code === code)?.name ?? code;

  return (
    <section aria-labelledby={titleId} className="space-y-3 text-left" data-testid="existing-import-result">
      <h3 id={titleId} className="text-base font-semibold">
        {t('octorate.connect.existing.result.title')}
      </h3>
      <ul className="space-y-2" role="list">
        {batch.data.channels.map((channel) => {
          const stopped = isChannelStopped(channel);
          const why = channel.errorCode ? (translateErrorCode(channel.errorCode, t) ?? t('octorate.connect.existing.errors.unknown')) : null;
          return (
            <li key={channel.channelCode} className="min-w-0 space-y-2 rounded-md border p-3 text-sm" data-testid={`existing-result-${channel.channelCode}`} data-status={channel.status}>
              <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
                <p className="break-words font-medium">{nameOf(channel.channelCode)}</p>
                <Badge variant={channel.status === 'Completed' ? 'success' : stopped ? 'destructive' : 'warning'} className="whitespace-nowrap">
                  {t(`octorate.connect.existing.result.status.${channel.status}`)}
                </Badge>
              </div>
              <p className="text-muted-foreground" data-testid={`existing-result-${channel.channelCode}-counts`}>
                {t('octorate.connect.existing.result.counts', {
                  connected: channel.counts.connected,
                  leftForLater: channel.counts.leftForLater,
                  failed: channel.counts.failed,
                })}
              </p>
              {stopped ? (
                <div className="space-y-2">
                  <p className="text-danger-foreground" role="alert">
                    {why ?? t('octorate.connect.existing.errors.unknown')}
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    className={TOUCH_TARGET}
                    loading={again.isPending}
                    onClick={() => again.mutate({ batchId })}
                    data-testid={`existing-result-${channel.channelCode}-retry`}
                  >
                    {t('octorate.connect.existing.progress.retry')}
                  </Button>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
      {again.isError ? (
        <p className="text-sm text-danger-foreground" role="alert">
          {getProblemMessage(again.error, t) ?? t('octorate.connect.existing.errors.unknown')}
        </p>
      ) : null}
      <p className="text-sm text-muted-foreground" data-testid="existing-result-migration-note">
        {t('octorate.connect.existing.result.migrationNote')}
      </p>
    </section>
  );
}

/**
 * The properties of a mixed portfolio that are new: CasaZen creates their listings only when the host says so, in the listing wizard, never as
 * part of the import of the others.
 */
export function NewListingsCard() {
  const { t } = useTranslation();
  const titleId = useId();

  return (
    <section aria-labelledby={titleId} className="space-y-2 rounded-lg bg-muted p-4 text-left" data-testid="new-listings-card">
      <h3 id={titleId} className="text-base font-semibold">
        {t('octorate.connect.existing.new.title')}
      </h3>
      <p className="text-sm">{t('octorate.connect.existing.new.text')}</p>
      <Button asChild size="sm" className={TOUCH_TARGET}>
        <Link to={PROPERTY_CREATE_PATH} data-testid="new-listings-link">
          {t('octorate.connect.existing.new.action')}
        </Link>
      </Button>
    </section>
  );
}
