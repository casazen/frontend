import { formatAbsolute, formatRelative } from '@/components/shared/timeline/timeline-time';
import type { CalendarOverview, CalendarOverviewFeed } from '@/types/property-ical';

const MS_PER_MINUTE = 60_000;

/**
 * A row of the page "Canali e calendari" (SR-10b): a calendar of a property, or a property that has none. The name of the property is
 * the title of both; only a calendar has a channel, a time and a state.
 */
export type CalendarRow =
  | { kind: 'feed'; key: string; propertyId: string; propertyName: string; exportUrl: string | null; feed: CalendarOverviewFeed }
  | { kind: 'none'; key: string; propertyId: string; propertyName: string };

/** The row of a calendar (the actions of the page are about these). */
export type FeedRow = Extract<CalendarRow, { kind: 'feed' }>;

/** One row per calendar of each property, in the order of the answer (by property, a failing calendar first), and one for a property with none. */
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

/** Where a calendar stands: syncing now, its last import failed, nothing for longer than the backend allows, never read, or fine. */
export type FeedHealth = 'syncing' | 'failed' | 'stale' | 'never' | 'ok';

/**
 * The state of a calendar. `staleAfterMinutes` is the backend's own threshold (a few rounds of the sync job, from the answer of the
 * overview), never a number written here; `lastImportAt` is the last try, a success or a failure.
 */
export function feedHealth(feed: CalendarOverviewFeed, staleAfterMinutes: number, now: Date, requested = false): FeedHealth {
  if (feed.syncing || requested) return 'syncing';
  if (feed.lastImportStatus === 'Failure' || feed.lastImportStatus === 'PartialFailure') return 'failed';
  const at = feed.lastImportAt ? Date.parse(feed.lastImportAt) : Number.NaN;
  if (Number.isNaN(at)) return 'never';
  return now.getTime() - at > staleAfterMinutes * MS_PER_MINUTE ? 'stale' : 'ok';
}

/** The host should have a look: the last import failed, the calendar is silent for too long, or it never answered. */
export const needsCheck = (health: FeedHealth): boolean => health === 'failed' || health === 'stale' || health === 'never';

/**
 * "3 minuti fa", "ieri", or the date once it is more than a week ago. A time a little ahead of this browser's clock (the server's is
 * the one that counts) reads as now.
 */
export function updatedWhen(lastImportAt: string, now: Date, locale: string): string {
  const parsed = new Date(lastImportAt);
  const at = parsed.getTime() > now.getTime() ? now : parsed;
  return formatRelative(at, now, locale) ?? formatAbsolute(at, now, locale);
}
