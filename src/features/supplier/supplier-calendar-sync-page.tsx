import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useCalendarSyncStatus, useSetIcalFeed } from '@/queries/use-supplier';
import { Calendar, Link2, Smartphone, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import { IcalHelpTooltip } from './components/ical-help-tooltip';

export function SupplierCalendarSyncPage() {
  const { t } = useTranslation();
  const { data: syncStatus, isLoading } = useCalendarSyncStatus();
  const setIcalFeedMutation = useSetIcalFeed();

  const [showIcalDialog, setShowIcalDialog] = useState(false);
  const [icalUrl, setIcalUrl] = useState('');
  const [saving, setSaving] = useState(false);

  if (isLoading) {
    return (
      <div>
        <Skeleton className="h-8 w-64" />
        <Skeleton className="mt-4 h-64" />
      </div>
    );
  }

  const hasIcal = syncStatus?.calendarSyncType === 'ICalFeed' && syncStatus?.icalFeedUrl;
  const hasError = !!syncStatus?.calendarSyncError;

  const handleSaveIcal = async () => {
    if (!icalUrl.trim()) return;
    setSaving(true);
    try {
      await setIcalFeedMutation.mutateAsync(icalUrl.trim());
      toast.success(t('supplier.syncSuccess'));
      setShowIcalDialog(false);
      setIcalUrl('');
    } catch {
      toast.error(t('supplier.syncError'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader
        title={t('supplier.calendarSyncTitle')}
        description={t('supplier.calendarSyncDescription')}
      />

      {/* iCal connected status */}
      {hasIcal && (
        <Card className="mb-4 border-green-300 bg-green-50 p-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 text-green-600 shrink-0" />
            <div className="flex-1">
              <p className="font-medium text-green-900">{t('supplier.icalConnected')}</p>
              <p className="text-sm text-green-700 break-all">{syncStatus?.icalFeedUrl}</p>
              {syncStatus?.calendarLastSyncAt && (
                <p className="mt-1 text-xs text-green-600">
                  {t('supplier.lastSync')}: {new Date(syncStatus.calendarLastSyncAt).toLocaleString()}
                </p>
              )}
            </div>
            <Button size="sm" variant="outline" className="border-green-400 text-green-900 shrink-0"
                    onClick={() => { setIcalUrl(syncStatus?.icalFeedUrl ?? ''); setShowIcalDialog(true); }}>
              {t('supplier.edit')}
            </Button>
          </div>
        </Card>
      )}

      {hasError && (
        <Card className="mb-4 border-red-300 bg-red-50 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 text-red-600 shrink-0" />
            <div>
              <p className="font-medium text-red-900">{t('supplier.syncError')}</p>
              <p className="text-sm text-red-700">{syncStatus?.calendarSyncError}</p>
            </div>
          </div>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        {/* Google Calendar — coming soon */}
        <Card className="flex flex-col items-center p-6 text-center">
          <Calendar className="mb-3 h-8 w-8 text-muted-foreground" />
          <h3 className="text-sm font-semibold">{t('supplier.googleCalendar')}</h3>
          <p className="mt-1 text-xs text-muted-foreground">{t('supplier.googleCalendarHint')}</p>
          <Button className="mt-4 w-full" variant="outline" disabled>
            {t('supplier.comingSoon')}
          </Button>
        </Card>

        {/* iCal Feed */}
        <Card className="flex flex-col items-center p-6 text-center">
          <Link2 className={`mb-3 h-8 w-8 ${hasIcal ? 'text-green-600' : 'text-primary'}`} />
          <h3 className="text-sm font-semibold">{t('supplier.icalFeed')}</h3>
          <p className="mt-1 text-xs text-muted-foreground">{t('supplier.icalFeedHint')}</p>
          <Button className="mt-4 w-full" variant={hasIcal ? 'outline' : 'default'}
                  onClick={() => { setIcalUrl(syncStatus?.icalFeedUrl ?? ''); setShowIcalDialog(true); }}>
            {hasIcal ? t('supplier.editIcalUrl') : t('supplier.pasteIcalUrl')}
          </Button>
        </Card>

        {/* WhatsApp — coming soon */}
        <Card className="flex flex-col items-center p-6 text-center">
          <Smartphone className="mb-3 h-8 w-8 text-muted-foreground" />
          <h3 className="text-sm font-semibold">{t('supplier.whatsappOption')}</h3>
          <p className="mt-1 text-xs text-muted-foreground">{t('supplier.whatsappHint')}</p>
          <Button className="mt-4 w-full" variant="outline" disabled>
            {t('supplier.comingSoon')}
          </Button>
        </Card>
      </div>

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
                <IcalHelpTooltip />
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
    </div>
  );
}
