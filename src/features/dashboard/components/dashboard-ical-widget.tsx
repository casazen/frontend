import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CalendarSync, ChevronRight, Loader2 } from 'lucide-react';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { getProblemMessage, translateErrorCode } from '@/lib/api-errors';
import { formatDateTime } from '@/lib/utils';
import { useDashboardIcalFeeds } from '@/queries/use-dashboard';
import type { DashboardIcalFeed } from '@/types/dashboard.types';
import type { PropertyIcalImportStatus } from '@/types/property-ical';

const STATUS_BADGE: Record<PropertyIcalImportStatus, BadgeProps['variant']> = {
  Success: 'success',
  PartialFailure: 'warning',
  Failure: 'destructive',
  Syncing: 'secondary',
};

/** The iCal screen of a property: the "Calendari iCal" tab of its detail. */
function propertyIcalPath(propertyId: string): string {
  return `/app/short-rent/properties/${propertyId}?tab=ical`;
}

function hasError(feed: DashboardIcalFeed): boolean {
  return feed.lastImportStatus === 'Failure' || feed.lastImportStatus === 'PartialFailure';
}

function normalizeFeeds(value: unknown): DashboardIcalFeed[] {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'object' || value === null) return [];
  const wrapped = (value as { data?: unknown }).data;
  return Array.isArray(wrapped) ? wrapped : [];
}

/**
 * iCal calendars of the host's properties (PC-16, in place of the OTA widget of the frozen partner API): per feed the
 * last sync, the translated status and error, and a link to the iCal screen of its property.
 */
export function DashboardIcalWidget() {
  const { t } = useTranslation();
  const feeds = useDashboardIcalFeeds();
  const rows = normalizeFeeds(feeds.data);
  const failing = rows.filter(hasError).length;

  return (
    <Card data-testid="dashboard-ical-widget">
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <CalendarSync className="h-5 w-5" />
            {t('dashboard.ical.title')}
          </CardTitle>
          <CardDescription>{t('dashboard.ical.description')}</CardDescription>
        </div>
        {failing > 0 && (
          <Badge variant="destructive" data-testid="dashboard-ical-failing">
            {t('dashboard.ical.failing', { count: failing })}
          </Badge>
        )}
      </CardHeader>
      <CardContent>
        {feeds.isLoading ? (
          <div className="space-y-3" data-testid="dashboard-ical-loading" aria-busy="true">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : feeds.isError ? (
          <div className="space-y-2 rounded-md border border-destructive/40 p-3" role="alert" data-testid="dashboard-ical-error">
            <p className="text-sm text-destructive">
              {getProblemMessage(feeds.error, t) ?? t('dashboard.ical.loadError')}
            </p>
            <Button type="button" variant="outline" size="sm" onClick={() => void feeds.refetch()}>
              {feeds.isFetching && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('dashboard.retry')}
            </Button>
          </div>
        ) : !rows.length ? (
          <p className="py-4 text-center text-sm text-muted-foreground" data-testid="dashboard-ical-empty">
            {t('dashboard.ical.empty')}
          </p>
        ) : (
          <ul className="space-y-2">
            {rows.map((feed) => (
              <FeedRow key={feed.feedId} feed={feed} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function FeedRow({ feed }: { feed: DashboardIcalFeed }) {
  const { t } = useTranslation();
  const status = feed.lastImportStatus ?? null;
  const feedName = feed.label?.trim() || t(`ical.channels.${feed.channel}`);
  // The error of the last sync, translated from its stable code (the backend text only as a fallback).
  const error = hasError(feed) ? translateErrorCode(feed.lastErrorCode, t) ?? feed.lastError ?? undefined : undefined;

  return (
    <li data-testid="dashboard-ical-feed">
      <Link
        to={propertyIcalPath(feed.propertyId)}
        className="flex items-start justify-between gap-3 rounded-md border px-3 py-2 transition-colors hover:bg-muted/40"
        data-testid="dashboard-ical-feed-link"
      >
        <div className="min-w-0 space-y-1">
          <p className="truncate text-sm font-medium">
            {feed.propertyName}
            <span className="text-muted-foreground"> · {feedName}</span>
          </p>
          <p className="text-xs text-muted-foreground">
            {feed.lastImportAt
              ? t('ical.lastSync', { date: formatDateTime(feed.lastImportAt) })
              : t('ical.neverSynced')}
          </p>
          {error && (
            <p className="text-xs text-destructive" data-testid="dashboard-ical-feed-error">
              {error}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Badge variant={status ? STATUS_BADGE[status] : 'outline'}>
            {t(status ? `ical.status.${status}` : 'ical.status.never')}
          </Badge>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </div>
      </Link>
    </li>
  );
}
