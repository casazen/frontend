import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/page-header';
import { PlainSection } from '@/components/shared/calm';
import { ConfirmationDialog } from '@/components/shared/confirmation-dialog';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { HelpTip } from '@/components/ui/help-tip';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useCalendarSyncStatus, useDisconnectIcalFeed, useSetIcalFeed, useSyncSupplierCalendarNow } from '@/queries/use-supplier';
import { getProblemMessage } from '@/lib/api-errors';
import { Loader2, RefreshCw } from 'lucide-react';

/**
 * The iCal calendar of the supplier (SU-15), a page that hangs from the agenda: what the calendar says the supplier is busy with
 * closes those hours for the customers. One feed, one link (Google, Outlook, Apple and the channels all give an iCal link).
 */
export function SupplierCalendarSyncPage() {
  const { t } = useTranslation();
  const { data: syncStatus, isLoading, isError, refetch } = useCalendarSyncStatus();
  const setIcalFeedMutation = useSetIcalFeed();
  const syncNowMutation = useSyncSupplierCalendarNow();
  const disconnectMutation = useDisconnectIcalFeed();

  const [showIcalDialog, setShowIcalDialog] = useState(false);
  const [confirmingDisconnect, setConfirmingDisconnect] = useState(false);
  const [icalUrl, setIcalUrl] = useState('');
  const [saving, setSaving] = useState(false);

  const header = (
    <PageHeader title={t('supplier.calendarSyncTitle')} description={t('supplier.calendarSyncDescription')} crumbs="auto" />
  );

  if (isLoading) {
    return (
      <div className="min-w-0 space-y-6">
        {header}
        <Skeleton className="h-40" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="min-w-0 space-y-6">
        {header}
        <Alert
          variant="danger"
          action={
            <Button size="sm" variant="outline" onClick={() => void refetch()}>
              {t('supplier.retry')}
            </Button>
          }
        >
          {t('supplier.calendarStatusLoadError')}
        </Alert>
      </div>
    );
  }

  const hasIcal = syncStatus?.calendarSyncType === 'ICalFeed' && syncStatus?.icalFeedUrl;
  // SU-15: the sync runs in a background job; "synced" only once the job has run (never right after saving).
  const syncing = syncStatus?.lastSyncStatus === 'Syncing';
  const synced = syncStatus?.lastSyncStatus === 'Success';
  const hasError = !syncing && !!syncStatus?.calendarSyncError;

  const openIcalDialog = () => {
    setIcalUrl(syncStatus?.icalFeedUrl ?? '');
    setShowIcalDialog(true);
  };

  const handleSaveIcal = async () => {
    if (!icalUrl.trim()) return;
    setSaving(true);
    try {
      await setIcalFeedMutation.mutateAsync(icalUrl.trim());
      toast.success(t('supplier.syncSuccess'));
      setShowIcalDialog(false);
      setIcalUrl('');
    } catch (error) {
      toast.error(getProblemMessage(error, t) ?? t('supplier.icalSaveError'));
    } finally {
      setSaving(false);
    }
  };

  // Unlinking asks first (the days the calendar closed open again for the customers). A failure is said here; the dialog closes after.
  const handleDisconnect = async () => {
    try {
      await disconnectMutation.mutateAsync();
      toast.success(t('supplier.icalDisconnected'));
    } catch (error) {
      toast.error(getProblemMessage(error, t) ?? t('supplier.icalDisconnectError'));
    }
  };

  const handleSyncNow = async () => {
    try {
      await syncNowMutation.mutateAsync();
      toast.success(t('supplier.syncSuccess'));
    } catch (error) {
      toast.error(getProblemMessage(error, t) ?? t('supplier.syncError'));
    }
  };

  return (
    <div className="min-w-0 space-y-6">
      {header}

      {hasIcal ? (
        <Alert
          variant="success"
          action={
            <>
              <Button size="sm" variant="outline" disabled={syncing || syncNowMutation.isPending} onClick={() => void handleSyncNow()}>
                <RefreshCw className={`mr-1 h-3 w-3 ${syncing || syncNowMutation.isPending ? 'animate-spin motion-reduce:animate-none' : ''}`} />
                {t('supplier.syncNow')}
              </Button>
              <Button size="sm" variant="outline" onClick={openIcalDialog}>
                {t('supplier.edit')}
              </Button>
              <Button size="sm" variant="outline" data-testid="ical-disconnect" onClick={() => setConfirmingDisconnect(true)}>
                {t('supplier.icalDisconnect')}
              </Button>
            </>
          }
        >
          <p className="font-medium">{t('supplier.icalConnected')}</p>
          <p className="break-all">{syncStatus?.icalFeedUrl}</p>
          {syncing && (
            <p className="mt-1 flex items-center gap-1 text-xs" role="status">
              <Loader2 className="h-3 w-3 animate-spin motion-reduce:animate-none" aria-hidden="true" />
              {t('supplier.syncInProgress')}
            </p>
          )}
          {synced && <p className="mt-1 text-xs">{t('supplier.syncCompleted')}</p>}
          {!syncing && syncStatus?.calendarLastSyncAt && (
            <p className="mt-1 text-xs">
              {t('supplier.lastSync')}: {new Date(syncStatus.calendarLastSyncAt).toLocaleString()}
            </p>
          )}
        </Alert>
      ) : (
        <PlainSection title={t('supplier.icalFeed')}>
          <p className="text-foreground/70">{t('supplier.icalFeedHint')}</p>
          <Button className="mt-2" onClick={openIcalDialog}>
            {t('supplier.pasteIcalUrl')}
          </Button>
        </PlainSection>
      )}

      {(syncStatus?.pendingFreeEventsCount ?? 0) > 0 && (
        <Alert
          variant="warning"
          data-testid="calendar-free-events-note"
          action={
            <Button asChild size="sm" variant="outline">
              <Link to="/app/supplier/availability">{t('supplier.freeEventsSyncNoteCta')}</Link>
            </Button>
          }
        >
          {t('supplier.freeEventsSyncNote', { count: syncStatus?.pendingFreeEventsCount })}
        </Alert>
      )}

      {hasError && (
        <Alert variant="danger">
          <p className="font-medium">{t('supplier.syncError')}</p>
          <p>{syncStatus?.calendarSyncError}</p>
        </Alert>
      )}

      {/* iCal Dialog */}
      <Dialog open={showIcalDialog} onOpenChange={setShowIcalDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('supplier.icalFeedUrlTitle')}</DialogTitle>
            <DialogDescription>{t('supplier.icalFeedUrlDescription')}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            <div>
              <div className="flex items-center gap-1.5">
                <Label htmlFor="ical-url">{t('supplier.icalFeedUrlLabel')}</Label>
                {/* UI-07 pilot of HelpTip: a bubble beside the label, a sheet from the bottom on a phone. The help page is the one inside the supplier console (SU-16). */}
                <HelpTip
                  label={t('supplier.help.icalTooltipLabel')}
                  learnMoreHref="/app/supplier/help/ical"
                  learnMoreLabel={t('supplier.help.icalTooltipCta')}
                >
                  {t('supplier.help.icalTooltipText')}
                </HelpTip>
              </div>
              <Input
                id="ical-url"
                className="mt-2"
                value={icalUrl}
                onChange={(e) => setIcalUrl(e.target.value)}
                placeholder="https://calendar.google.com/calendar/ical/..."
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-4">
            <Button variant="outline" onClick={() => setShowIcalDialog(false)} disabled={saving}>
              {t('shared.cancel')}
            </Button>
            <Button onClick={() => void handleSaveIcal()} disabled={saving || !icalUrl.trim()}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('supplier.saveAndSync')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmationDialog
        open={confirmingDisconnect}
        onOpenChange={setConfirmingDisconnect}
        title={t('supplier.icalDisconnectTitle')}
        description={t('supplier.icalDisconnectDescription')}
        confirmLabel={t('supplier.icalDisconnect')}
        consequences={[t('supplier.icalDisconnectReopens'), t('supplier.icalDisconnectEvents')]}
        isLoading={disconnectMutation.isPending}
        onConfirm={handleDisconnect}
      />
    </div>
  );
}
