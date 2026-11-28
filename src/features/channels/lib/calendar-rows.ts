import { formatAbsolute, formatRelative } from '@/components/shared/timeline/timeline-time';
import type { CalendarOverview, CalendarOverviewFeed } from '@/types/property-ical';

const MS_PER_MINUTE = 60_000;

export type CalendarRow =
  | { kind: 'feed'; key: string; propertyId: string; propertyName: string; exportUrl: string | null; feed: CalendarOverviewFeed }
  | { kind: 'none'; key: string; propertyId: string; propertyName: string };

export type FeedRow = Extract<CalendarRow, { kind: 'feed' }>;

export function buildCalendarRows(overview: CalendarOverview): CalendarRow[] {
  return overview.properties.flatMap((property): CalendarRow[] =>
    property.feeds.length === 0
      ? [{ kind: 'none', key: `none:${property.propertyId}`, propertyId: property.propertyId, propertyName: property.propertyName }]
      : property.feeds.map((feed) => ({
          kind: 'feed',
          key: feed.feedId,
          propertyId: property.propertyId,
          propertyName: property.propertyName,
          exportUrl: property.exportUrl ?? null,
          feed,
        })),
  );
}

export type FeedHealth = 'syncing' | 'failed' | 'stale' | 'never' | 'ok';

export function feedHealth(feed: CalendarOverviewFeed, staleAfterMinutes: number, now: Date, requested = false): FeedHealth {
  if (feed.syncing || requested) return 'syncing';
  if (feed.lastImportStatus === 'Failure' || feed.lastImportStatus === 'PartialFailure') return 'failed';
  const at = feed.lastImportAt ? Date.parse(feed.lastImportAt) : Number.NaN;
  if (Number.isNaN(at)) return 'never';
  return now.getTime() - at > staleAfterMinutes * MS_PER_MINUTE ? 'stale' : 'ok';
}

export const needsCheck = (health: FeedHealth): boolean => health === 'failed' || health === 'stale' || health === 'never';

export function updatedWhen(lastImportAt: string, now: Date, locale: string): string {
  const parsed = new Date(lastImportAt);
  const at = parsed.getTime() > now.getTime() ? now : parsed;
  return formatRelative(at, now, locale) ?? formatAbsolute(at, now, locale);
}
