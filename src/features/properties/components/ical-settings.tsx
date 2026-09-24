import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CalendarSync, Copy, Loader2, RefreshCw, Trash2 } from 'lucide-react';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { translateErrorCode } from '@/lib/api-errors';
import { formatDateTime } from '@/lib/utils';
import {
  useAddPropertyIcalFeed,
  usePropertyIcalExportUrl,
  usePropertyIcalFeeds,
  useRemovePropertyIcalFeed,
  useSyncPropertyIcalFeed,
} from '@/queries/use-property-ical';
import type { PropertyIcalFeed, PropertyIcalFeedChannel, PropertyIcalImportStatus } from '@/types/property-ical';

interface IcalSettingsProps {
  propertyId: string;
}

const LABEL_MAX_LENGTH = 60;
const CHANNELS: PropertyIcalFeedChannel[] = ['Airbnb', 'BookingCom', 'Other'];

const STATUS_BADGE: Record<PropertyIcalImportStatus, BadgeProps['variant']> = {
  Success: 'success',
  PartialFailure: 'warning',
  Failure: 'destructive',
  Syncing: 'secondary',
};

/**
 * iCal calendars of a property (PC-11): the import feeds (Airbnb, Booking.com, others), each with its own state and
 * "sync now" / "disconnect", the form to link another one, and the export link for the OTAs.
 */
export function IcalSettings({ propertyId }: IcalSettingsProps) {
  const { t } = useTranslation();
  const feeds = usePropertyIcalFeeds(propertyId);
  const exportUrl = usePropertyIcalExportUrl(propertyId);
  const [feedToRemove, setFeedToRemove] = useState<PropertyIcalFeed | null>(null);
  const [copied, setCopied] = useState(false);
  const removeFeed = useRemovePropertyIcalFeed(propertyId);

  const handleCopyExport = async () => {
    if (!exportUrl.data?.exportUrl) return;
    await navigator.clipboard.writeText(exportUrl.data.exportUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  const confirmRemove = () => {
    if (!feedToRemove) return;
    removeFeed.mutate(feedToRemove.id, { onSettled: () => setFeedToRemove(null) });
  };

  return (
    <Card data-testid="property-ical-settings">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarSync className="h-5 w-5" />
          {t('ical.title')}
        </CardTitle>
        <CardDescription>{t('ical.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <section className="space-y-3" aria-labelledby="ical-feeds-title">
          <h3 id="ical-feeds-title" className="text-sm font-medium">
            {t('ical.feedsTitle')}
          </h3>
          {feeds.isLoading ? (
            <div className="flex justify-center py-4" data-testid="ical-feeds-loading">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : feeds.isError ? (
            <div className="space-y-2 rounded-md border border-destructive/40 p-3" role="alert">
              <p className="text-sm text-destructive">{t('ical.feedsLoadError')}</p>
              <Button type="button" variant="outline" size="sm" onClick={() => void feeds.refetch()}>
                {t('ical.retry')}
              </Button>
            </div>
          ) : !feeds.data?.length ? (
            <p className="text-sm text-muted-foreground">{t('ical.noFeeds')}</p>
          ) : (
            <ul className="space-y-3">
              {feeds.data.map((feed) => (
                <FeedRow
                  key={feed.id}
                  propertyId={propertyId}
                  feed={feed}
                  onRemove={() => setFeedToRemove(feed)}
                  removing={removeFeed.isPending && removeFeed.variables === feed.id}
                />
              ))}
            </ul>
          )}
        </section>

        <AddFeedForm propertyId={propertyId} />

        <div className="space-y-2">
          <Label htmlFor="property-ical-export">{t('ical.exportUrlLabel')}</Label>
          <div className="flex gap-2">
            <Input id="property-ical-export" readOnly value={exportUrl.data?.exportUrl ?? ''} />
            <Button type="button" variant="outline" onClick={() => void handleCopyExport()} disabled={!exportUrl.data?.exportUrl}>
              <Copy className="h-4 w-4" />
              {copied ? t('ical.copied') : t('ical.copy')}
            </Button>
          </div>
          {exportUrl.isError ? (
            <p className="text-xs text-destructive">{t('ical.exportLoadError')}</p>
          ) : (
            <p className="text-xs text-muted-foreground">{t('ical.exportHint')}</p>
          )}
        </div>
      </CardContent>

      <Dialog open={feedToRemove !== null} onOpenChange={(open) => !open && setFeedToRemove(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('ical.removeTitle')}</DialogTitle>
            <DialogDescription>
              {feedToRemove && t('ical.removeDescription', { name: feedName(feedToRemove, t) })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setFeedToRemove(null)}>
              {t('ical.cancel')}
            </Button>
            <Button type="button" variant="destructive" onClick={confirmRemove} disabled={removeFeed.isPending}>
              {removeFeed.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('ical.removeConfirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function feedName(feed: PropertyIcalFeed, t: (key: string) => string): string {
  return feed.label?.trim() || t(`ical.channels.${feed.channel}`);
}

interface FeedRowProps {
  propertyId: string;
  feed: PropertyIcalFeed;
  onRemove: () => void;
  removing: boolean;
}

function FeedRow({ propertyId, feed, onRemove, removing }: FeedRowProps) {
  const { t } = useTranslation();
  const syncFeed = useSyncPropertyIcalFeed(propertyId);
  const status = feed.lastImportStatus ?? null;
  const syncing = status === 'Syncing' || syncFeed.isPending;
  // The error of the last completed sync, translated from its stable code (the backend text only as a fallback).
  const error =
    status === 'Failure' || status === 'PartialFailure'
      ? translateErrorCode(feed.lastErrorCode, t) ?? feed.lastError ?? undefined
      : undefined;

  return (
    <li className="space-y-2 rounded-md border p-3" data-testid="ical-feed-row">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
            {feedName(feed, t)}
            {feed.label?.trim() && <Badge variant="outline">{t(`ical.channels.${feed.channel}`)}</Badge>}
          </p>
          {feed.maskedImportUrl && (
            <p className="truncate font-mono text-xs text-muted-foreground">{feed.maskedImportUrl}</p>
          )}
        </div>
        <Badge variant={status ? STATUS_BADGE[status] : 'outline'}>
          {t(status ? `ical.status.${status}` : 'ical.status.never')}
        </Badge>
      </div>
      <p className="text-xs text-muted-foreground">
        {feed.lastImportAt ? t('ical.lastSync', { date: formatDateTime(feed.lastImportAt) }) : t('ical.neverSynced')}
        {' · '}
        {t('ical.blockCount', { count: feed.blockCount })}
      </p>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => syncFeed.mutate(feed.id)} disabled={syncing}>
          <RefreshCw className={syncing ? 'mr-2 h-4 w-4 animate-spin' : 'mr-2 h-4 w-4'} />
          {syncing ? t('ical.syncing') : t('ical.syncNow')}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onRemove} disabled={removing}>
          <Trash2 className="mr-2 h-4 w-4" />
          {t('ical.remove')}
        </Button>
      </div>
    </li>
  );
}

function AddFeedForm({ propertyId }: { propertyId: string }) {
  const { t } = useTranslation();
  const addFeed = useAddPropertyIcalFeed(propertyId);
  const [channel, setChannel] = useState<PropertyIcalFeedChannel>('Airbnb');
  const [label, setLabel] = useState('');
  const [importUrl, setImportUrl] = useState('');

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const url = importUrl.trim();
    if (!url) return;
    addFeed.mutate(
      { channel, label: label.trim() || undefined, importUrl: url },
      {
        onSuccess: () => {
          setImportUrl('');
          setLabel('');
        },
      },
    );
  };

  return (
    <form className="space-y-3 rounded-md border p-4" onSubmit={handleSubmit} aria-labelledby="ical-add-title">
      <h3 id="ical-add-title" className="text-sm font-medium">
        {t('ical.addTitle')}
      </h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="property-ical-channel">{t('ical.channelLabel')}</Label>
          <select
            id="property-ical-channel"
            value={channel}
            onChange={(e) => setChannel(e.target.value as PropertyIcalFeedChannel)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            {CHANNELS.map((value) => (
              <option key={value} value={value}>
                {t(`ical.channels.${value}`)}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="property-ical-label">{t('ical.feedLabelLabel')}</Label>
          <Input
            id="property-ical-label"
            value={label}
            maxLength={LABEL_MAX_LENGTH}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={t('ical.feedLabelPlaceholder')}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="property-ical-import">{t('ical.importUrlLabel')}</Label>
        <Input
          id="property-ical-import"
          type="url"
          inputMode="url"
          autoComplete="off"
          value={importUrl}
          onChange={(e) => setImportUrl(e.target.value)}
          placeholder={t('ical.importUrlPlaceholder')}
        />
        <p className="text-xs text-muted-foreground">
          {t('ical.importHint')}{' '}
          <Link to="/help/ical" className="text-primary hover:underline">
            {t('ical.helpLink')}
          </Link>
        </p>
      </div>
      <Button type="submit" disabled={addFeed.isPending || !importUrl.trim()}>
        {addFeed.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {t('ical.addFeed')}
      </Button>
    </form>
  );
}
