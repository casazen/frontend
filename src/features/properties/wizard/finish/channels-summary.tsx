import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { StatusBadge } from '@/components/shared/status/status-badge';
import { Button } from '@/components/ui/button';
import { useListingStatus } from '@/queries/use-listing-status';
import { useChannelName } from '../../components/channel-name';
import { channelEntries } from '../channels-model';

interface ChannelsSummaryProps {
  propertyId: string;
  /** The channels the host chose to leave out in the channels step. */
  leftOut: readonly string[];
}

/**
 * «Canali» in the summary of the last step (NF-05): before the publication what will happen on each channel — it will be published, the
 * host left it out, its content is managed on the channel — and after it the result of each channel as the server tells it, with the
 * reason in simple words when it needs a look. It reads the status; nothing is worked out here.
 */
export function ChannelsSummary({ propertyId, leftOut }: ChannelsSummaryProps) {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const channelName = useChannelName();
  const status = useListingStatus(propertyId);
  const entries = channelEntries(status.data);

  const edit = () => {
    const next = new URLSearchParams(searchParams);
    next.set('step', 'channels');
    return { search: next.toString() };
  };

  return (
    <div className="min-w-0 space-y-1" data-testid="property-wizard-summary-channels">
      <div className="flex min-w-0 items-center justify-between gap-2">
        <h4 className="text-sm font-medium">{t('propertyWizard.last.summary.channels')}</h4>
        <Button asChild variant="ghost" size="sm">
          <Link to={edit()} aria-label={`${t('propertyWizard.last.summary.edit')}: ${t('propertyWizard.last.summary.channels')}`}>
            {t('propertyWizard.last.summary.edit')}
          </Link>
        </Button>
      </div>
      {status.isLoading ? (
        <p className="text-sm text-foreground/70">{t('propertyWizard.channels.loading')}</p>
      ) : status.isError ? (
        <p className="text-sm text-foreground/70">{t('propertyWizard.last.summary.channelsFailed')}</p>
      ) : (
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 gap-y-1 text-sm">
          {entries.map(({ code, row, managed, selectable }) => {
            const published = row !== null && row.status !== 'Draft';
            return (
              <div key={code} className="contents" data-testid={`property-wizard-summary-channel-${code}`}>
                <dt className="text-foreground/70">{channelName(code)}</dt>
                <dd className="min-w-0 break-words">
                  {managed ? (
                    t('propertyWizard.channels.managed', { channel: channelName(code) })
                  ) : published ? (
                    <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                      <StatusBadge kind="channel" status={row.status} />
                      {row.reason ? <span>{row.reason}</span> : null}
                    </span>
                  ) : selectable && !leftOut.includes(code) ? (
                    t('propertyWizard.last.summary.willPublish')
                  ) : (
                    t('propertyWizard.last.summary.notNow')
                  )}
                </dd>
              </div>
            );
          })}
        </dl>
      )}
    </div>
  );
}
