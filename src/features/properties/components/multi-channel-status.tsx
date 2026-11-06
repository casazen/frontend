import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Clock } from 'lucide-react';
import { StatusBadge } from '@/components/shared/status/status-badge';
import { STATUS_TONE_CLASSES } from '@/components/shared/status/status-view';
import { Button } from '@/components/ui/button';
import { useListingStatus } from '@/queries/use-listing-status';
import { cn } from '@/lib/utils';
import type { ChannelPublishStatus } from '@/types';
import { firstStepToFix } from '../wizard/channels-model';
import { propertyWizardPath } from '../properties-paths';
import { useChannelName } from './channel-name';

/** «Sincronizzazione in ritardo»: the channel manager has not confirmed the content for more than a day (NF-09, ADR-034). */
export function SyncDelayedBadge({ className }: { className?: string }) {
  const { t } = useTranslation();

  return (
    <span
      className={cn('inline-flex max-w-full items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset', STATUS_TONE_CLASSES.warning, className)}
      data-testid="sync-delayed-badge"
    >
      <Clock aria-hidden="true" className="size-3.5 shrink-0" />
      <span className="min-w-0 break-words">{t('listingStatus.syncDelayed')}</span>
    </span>
  );
}

interface SummaryProps {
  propertyId: string;
  /** The worst state of the property across its channels and the alert of a channel not confirmed for a day: the summary endpoint's row. */
  worstStatus: ChannelPublishStatus;
  syncAlert: boolean;
  /** `property.write`: «Correggi» leads to the wizard, which is for who may write. */
  canWrite: boolean;
}

/**
 * The listing of a property in one line, for the list of the properties: the worst state of its channels, «Sincronizzazione in ritardo» when
 * a channel is not confirmed, and «Correggi» when something is to fix. «Correggi» opens the wizard at the channels, where the state of each
 * one and what lacks are told: the list knows only the worst state.
 */
export function ChannelSummary({ propertyId, worstStatus, syncAlert, canWrite }: SummaryProps) {
  const { t } = useTranslation();

  return (
    <div className="flex min-w-0 flex-col items-start gap-1" data-testid="channel-summary" data-status={worstStatus}>
      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
        <StatusBadge kind="channel" status={worstStatus} />
        {syncAlert ? <SyncDelayedBadge /> : null}
      </div>
      {canWrite && worstStatus === 'ToFix' ? (
        <Button asChild variant="link" size="sm" className="h-auto min-h-11 p-0 md:min-h-0">
          <Link to={propertyWizardPath(propertyId, 'channels')} data-testid="channel-fix">
            {t('listingStatus.fix')}
          </Link>
        </Button>
      ) : null}
    </div>
  );
}

interface DetailProps {
  propertyId: string;
  canWrite: boolean;
}

/**
 * The listing of a property on each channel, for its sheet (NF-09, NF-27, NF-38): one badge for each channel in words and with an icon (green
 * published, yellow sending or accepted, red to fix, grey managed on the channel or draft), «Sincronizzazione in ritardo» when the status
 * says so, the reason in simple words for a channel to fix and «Correggi», which opens the wizard at the first step that lacks data.
 * Nothing while the property was never published: there is nothing to tell.
 */
export function MultiChannelStatus({ propertyId, canWrite }: DetailProps) {
  const { t } = useTranslation();
  const channelName = useChannelName();
  const status = useListingStatus(propertyId);
  const rows = status.data?.channels ?? [];

  if (status.isLoading) return null;
  if (status.isError) {
    return (
      <p className="text-sm text-foreground/70" data-testid="multi-channel-status-error">
        {t('listingStatus.loadFailed')}
      </p>
    );
  }
  if (rows.length === 0) {
    return (
      <p className="text-sm text-foreground/70" data-testid="multi-channel-status-empty">
        {t('listingStatus.none')}
      </p>
    );
  }

  const toFix = rows.some((row) => row.status === 'ToFix' || row.missing.length > 0);

  return (
    <div className="space-y-3" data-testid="multi-channel-status">
      <ul className="space-y-2">
        {rows.map((row) => (
          <li key={row.channel} className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1" data-testid={`multi-channel-${row.channel}`} data-status={row.status}>
            <span className="min-w-0 break-words text-sm font-medium">{channelName(row.channel)}</span>
            <StatusBadge kind="channel" status={row.status} />
            {row.syncAlert ? <SyncDelayedBadge /> : null}
            {row.status === 'ToFix' && row.reason ? <span className="basis-full text-sm text-foreground/70">{row.reason}</span> : null}
          </li>
        ))}
      </ul>
      {canWrite && toFix ? (
        <Button asChild size="sm" variant="outline" className="min-h-11 md:min-h-0">
          <Link to={propertyWizardPath(propertyId, firstStepToFix(status.data))} data-testid="multi-channel-fix">
            {t('listingStatus.fix')}
          </Link>
        </Button>
      ) : null}
    </div>
  );
}
