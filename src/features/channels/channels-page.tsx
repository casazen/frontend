import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarDays } from 'lucide-react';
import { toast } from 'sonner';
import { propertyIcalApi } from '@/api/property-ical.api';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { HelpTip } from '@/components/ui/help-tip';
import { SkeletonCard, SkeletonLine } from '@/components/ui/skeleton';
import { PROPERTIES_PATH } from '@/features/properties/properties-paths';
import { useFeatureFlags } from '@/hooks/use-feature-flags';
import { useWorkspace } from '@/hooks/use-workspace';
import { useCalendarOverview, useSyncCalendarFeed } from '@/queries/use-property-ical';
import { CalendarRowItem } from './calendar-row';
import { buildCalendarRows, type FeedRow } from './lib/calendar-rows';

const TICK_MS = 60_000;

/** The time now, again every minute: "3 minuti fa" does not stay "ora" on a page that is left open. */
function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), TICK_MS);
    return () => clearInterval(timer);
  }, []);
  return now;
}

/**
 * `/app/short-rent/channels`: the calendars of every property in one list (SR-10b, the reduced version of the reviewer): one row for
 * each calendar the host linked (Airbnb, Booking.com, others) with the channel, when it was last read, "Da ricontrollare" and the
 * error in words when it needs a look, and the button "Sincronizza ora"; one row for each property that has none, with "Collega",
 * which leads to the tab Calendari of the property (where calendars are linked, as before). The link of CasaZen to paste on the
 * portals is copied from the "⋯" of a row, with the warning that whoever has it sees the dates.
 *
 * Everything comes from `GET api/properties/calendar-overview`: the page says how often the calendars are read and when one counts as
 * silent from what the backend answers, never from a number of its own. Who may not write the properties (`property.write`) sees the
 * state and no button. One poll for the whole page while any calendar syncs.
 */
export function ChannelsPage() {
  const { t } = useTranslation();
  const overview = useCalendarOverview();
  const { mutate: syncFeed, isPending: syncRequested, variables: syncVariables } = useSyncCalendarFeed();
  const { hasPermission } = useWorkspace();
  const { flags } = useFeatureFlags();
  const tick = useNow();
  const canWrite = hasPermission('short-rent', 'property.write');

  const data = overview.data;
  // The clock of the page, never behind the answer it just got.
  const now = useMemo(() => new Date(Math.max(tick.getTime(), overview.dataUpdatedAt)), [tick, overview.dataUpdatedAt]);
  const rows = useMemo(() => (data ? buildCalendarRows(data) : []), [data]);

  const handleSync = useCallback((row: FeedRow) => syncFeed({ propertyId: row.propertyId, feedId: row.feed.feedId }), [syncFeed]);

  const handleCopyLink = useCallback(
    async (row: FeedRow) => {
      try {
        // A property whose link nobody asked for yet has none in the overview: the single read creates it.
        const url = row.exportUrl ?? (await propertyIcalApi.getExportUrl(row.propertyId)).exportUrl;
        await navigator.clipboard.writeText(url);
        toast.success(t('ical.copied'), { description: t('ical.exportPrivate') });
      } catch {
        toast.error(t('channels.copyFailed'));
      }
    },
    [t],
  );

  return (
    <AppShell>
      <div className="space-y-6" data-testid="channels-page">
        <PageHeader title={t('channels.title')} description={t('channels.description')} />

        {overview.isError && !data ? (
          <ErrorState title={t('channels.loadError')} error={overview.error} onRetry={() => void overview.refetch()} testId="channels-error-state" />
        ) : !data ? (
          <div className="space-y-4">
            <SkeletonCard lines={3} label={t('channels.loading')} />
            <SkeletonLine lines={3} />
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title={t('channels.emptyTitle')}
            description={t('channels.emptyDescription')}
            action={{ label: t('channels.toProperties'), href: PROPERTIES_PATH }}
          />
        ) : (
          <>
            <div className="space-y-2 text-sm text-foreground/80" data-testid="channels-intro">
              <p>
                {t('channels.intro', { count: data.syncEveryMinutes })}{' '}
                <HelpTip title={t('channels.help.title')} learnMoreHref="/help/ical" learnMoreLabel={t('ical.helpLink')}>
                  {flags.otaPartnerApi ? t('channels.help.ical') : `${t('channels.help.ical')} ${t('channels.help.noDirect')}`}
                </HelpTip>
              </p>
              <p>{t('channels.privacy')}</p>
            </div>

            <ul role="list" className="divide-y divide-border border-y border-border" data-testid="channels-list">
              {rows.map((row) => (
                <CalendarRowItem
                  key={row.key}
                  row={row}
                  staleAfterMinutes={data.staleAfterMinutes}
                  now={now}
                  canWrite={canWrite}
                  requested={row.kind === 'feed' && syncRequested && syncVariables?.feedId === row.feed.feedId}
                  onSync={handleSync}
                  onCopyLink={(feedRow) => void handleCopyLink(feedRow)}
                />
              ))}
            </ul>
          </>
        )}
      </div>
    </AppShell>
  );
}
