import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Building2, CalendarDays, Copy, House, Link2, MoreHorizontal, RefreshCw, type LucideIcon } from 'lucide-react';
import { STATUS_TONE_CLASSES } from '@/components/shared/status/status-view';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ComplianceRow, ROW_BUTTON } from '@/features/compliance/components/compliance-row';
import { NoteLine } from '@/features/dashboard/components/note-line';
import { propertyTabPath } from '@/features/properties/properties-paths';
import { translateErrorCode } from '@/lib/api-errors';
import { cn } from '@/lib/utils';
import type { PropertyIcalFeedChannel } from '@/types/property-ical';
import { feedHealth, needsCheck, updatedWhen, type CalendarRow, type FeedRow } from './lib/calendar-rows';

/** The icon and the color of each channel (the same icons as the timeline of the calendar); the name is always written next to them. */
const CHANNELS: Record<PropertyIcalFeedChannel, { icon: LucideIcon; className: string }> = {
  Airbnb: { icon: House, className: 'bg-primary-soft text-primary-text ring-primary/30' },
  BookingCom: { icon: Building2, className: STATUS_TONE_CLASSES.info },
  Other: { icon: Link2, className: STATUS_TONE_CLASSES.neutral },
};

function ChannelChip({ channel }: { channel: PropertyIcalFeedChannel }) {
  const { t } = useTranslation();
  const { icon: Icon, className } = CHANNELS[channel];
  return (
    <span
      data-testid="channels-channel"
      className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset', className)}
    >
      <Icon aria-hidden="true" className="size-3.5 shrink-0" />
      {t(`ical.channels.${channel}`)}
    </span>
  );
}

interface CalendarRowItemProps {
  row: CalendarRow;
  /** The backend's threshold for "not tried for a while" (from the answer of the overview). */
  staleAfterMinutes: number;
  now: Date;
  /** Who may sync and link calendars (`property.write`); the others see the state and no button. */
  canWrite: boolean;
  /** The sync of this calendar was asked for and the answer has not come yet. */
  requested: boolean;
  onSync: (row: FeedRow) => void;
  onCopyLink: (row: FeedRow) => void;
}

/**
 * A row of the page "Canali e calendari" (SR-10b), on the row of the pages of the adempimenti: a property and one of its calendars with
 * the channel, when it was last read and, when it needs a look, the badge "Da ricontrollare" and the error in words; or a property with
 * no calendar and the way to link one. The one button of a calendar is "Sincronizza ora"; "Copia il link di CasaZen" is in "⋯".
 */
export function CalendarRowItem({ row, staleAfterMinutes, now, canWrite, requested, onSync, onCopyLink }: CalendarRowItemProps) {
  const { t, i18n } = useTranslation();

  if (row.kind === 'none') {
    const connect = t('channels.connect');
    return (
      <ComplianceRow
        icon={CalendarDays}
        title={row.propertyName}
        sub={t('channels.none')}
        testId="channels-row"
        action={
          canWrite ? (
            <Button asChild variant="outline" size="sm" className={ROW_BUTTON}>
              <Link
                to={propertyTabPath(row.propertyId, 'ical')}
                aria-label={t('dashboard.row.actionFor', { action: connect, name: row.propertyName })}
                data-testid="channels-connect"
              >
                {connect}
              </Link>
            </Button>
          ) : undefined
        }
      />
    );
  }

  const { feed } = row;
  const health = feedHealth(feed, staleAfterMinutes, now, requested);
  const syncing = health === 'syncing';
  const name = [row.propertyName, feed.label?.trim() || t(`ical.channels.${feed.channel}`)].join(', ');
  // The error of the last import, translated from its stable code (the backend text only when the frontend has none).
  const error = health === 'failed' ? (translateErrorCode(feed.lastErrorCode, t) ?? feed.lastError ?? t('channels.failed')) : undefined;
  const updated = feed.lastImportAt
    ? t('channels.updated', { when: updatedWhen(feed.lastImportAt, now, i18n.language) })
    : t('channels.neverUpdated');
  const syncLabel = syncing ? t('channels.syncing') : t('ical.syncNow');

  return (
    <ComplianceRow
      icon={CalendarDays}
      title={row.propertyName}
      sub={feed.label?.trim() || undefined}
      testId="channels-row"
      badge={
        <>
          <ChannelChip channel={feed.channel} />
          {needsCheck(health) ? (
            <Badge variant="warning" data-testid="channels-check">
              <AlertTriangle aria-hidden="true" className="mr-1 size-3 shrink-0" />
              {t('channels.checkAgain')}
            </Badge>
          ) : null}
        </>
      }
      note={
        <>
          <NoteLine note={{ tone: health === 'stale' || health === 'never' ? 'warning' : 'neutral', text: updated }} />
          {error ? (
            <span className="basis-full" data-testid="channels-error">
              <NoteLine note={{ tone: 'danger', text: error }} />
            </span>
          ) : null}
        </>
      }
      action={
        canWrite ? (
          <div className="flex w-full items-center gap-2 sm:w-auto">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={cn(ROW_BUTTON, 'flex-1 sm:flex-none')}
              disabled={syncing}
              onClick={() => onSync(row)}
              aria-label={t('dashboard.row.actionFor', { action: syncLabel, name })}
              data-testid="channels-sync"
            >
              <RefreshCw aria-hidden="true" className={cn('mr-2 size-4 shrink-0', syncing && 'animate-spin motion-reduce:animate-none')} />
              {syncLabel}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="ghost" size="icon" className="shrink-0" aria-label={t('listView.row.more', { name })} data-testid="channels-more">
                  <MoreHorizontal aria-hidden="true" className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-48">
                <DropdownMenuItem className="gap-2 pointer-coarse:min-h-11" onSelect={() => onCopyLink(row)} data-testid="channels-copy">
                  <Copy aria-hidden="true" className="size-4 shrink-0" />
                  {t('channels.copyLink')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ) : undefined
      }
    />
  );
}
