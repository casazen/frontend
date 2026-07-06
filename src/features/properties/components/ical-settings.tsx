import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CalendarSync, Copy, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { usePropertyIcalStatus, useSetPropertyIcalImportUrl } from '@/queries/use-property-ical';

interface IcalSettingsProps {
  propertyId: string;
}

export function IcalSettings({ propertyId }: IcalSettingsProps) {
  const { t } = useTranslation();
  const { data: status, isLoading } = usePropertyIcalStatus(propertyId);
  const setImportUrl = useSetPropertyIcalImportUrl(propertyId);
  const [importUrl, setImportUrlValue] = useState('');
  const [copied, setCopied] = useState(false);

  const handleSave = async () => {
    if (!importUrl.trim()) return;
    await setImportUrl.mutateAsync(importUrl.trim());
    setImportUrlValue('');
  };

  const handleCopyExport = async () => {
    if (!status?.exportUrl) return;
    await navigator.clipboard.writeText(status.exportUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

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
        <div className="space-y-2">
          <Label htmlFor="property-ical-import">{t('ical.importUrlLabel')}</Label>
          <Input
            id="property-ical-import"
            value={importUrl || status?.importUrl || ''}
            onChange={(e) => setImportUrlValue(e.target.value)}
            placeholder="https://www.airbnb.com/calendar/ical/..."
          />
          <p className="text-xs text-muted-foreground">
            {t('ical.importHint')}{' '}
            <Link to="/help/ical" className="text-primary hover:underline">
              {t('ical.helpLink')}
            </Link>
          </p>
          <Button onClick={() => void handleSave()} disabled={setImportUrl.isPending || !(importUrl.trim() || status?.importUrl)}>
            {setImportUrl.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('ical.saveImport')}
          </Button>
        </div>

        <div className="space-y-2 rounded-md border p-4">
          <p className="text-sm font-medium">{t('ical.syncStatus')}</p>
          <p className="text-sm text-muted-foreground">
            {status?.lastImportAt
              ? t('ical.lastSync', { date: new Date(status.lastImportAt).toLocaleString() })
              : t('ical.neverSynced')}
          </p>
          {status?.lastImportStatus && (
            <p className="text-sm">{t('ical.statusValue', { status: status.lastImportStatus })}</p>
          )}
          {status?.lastError && (
            <p className="text-sm text-destructive">{status.lastError}</p>
          )}
          <p className="text-sm text-muted-foreground">
            {t('ical.blockCount', { count: status?.blockCount ?? 0 })}
          </p>
        </div>

        <div className="space-y-2">
          <Label>{t('ical.exportUrlLabel')}</Label>
          <div className="flex gap-2">
            <Input readOnly value={status?.exportUrl ?? ''} />
            <Button type="button" variant="outline" onClick={() => void handleCopyExport()} disabled={!status?.exportUrl}>
              <Copy className="h-4 w-4" />
              {copied ? t('ical.copied') : t('ical.copy')}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">{t('ical.exportHint')}</p>
        </div>
      </CardContent>
    </Card>
  );
}
