import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Copy, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { usePropertyIcalExportUrl } from '@/queries/use-property-ical';

const COPIED_FEEDBACK_MS = 2_000;

/**
 * Export link of a property (PC-13): the URL the OTAs import to see the dates taken on CasaZen, with copy and the
 * steps to paste it on Airbnb and Booking.com.
 */
export function IcalExportSection({ propertyId }: { propertyId: string }) {
  const { t } = useTranslation();
  const exportUrl = usePropertyIcalExportUrl(propertyId);
  const inputRef = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = useState(false);
  const url = exportUrl.data?.exportUrl;

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const handleCopy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      // No clipboard (insecure context, permission denied): select the link so the host can copy it by hand.
      inputRef.current?.select();
      toast.error(t('ical.copyFailed'));
    }
  };

  return (
    <section className="space-y-3 rounded-md border p-4" aria-labelledby="ical-export-title" data-testid="ical-export">
      <div className="space-y-1">
        <h3 id="ical-export-title" className="text-sm font-medium">
          {t('ical.exportTitle')}
        </h3>
        <p className="text-xs text-muted-foreground">{t('ical.exportDescription')}</p>
      </div>

      {exportUrl.isLoading ? (
        <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground" data-testid="ical-export-loading">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t('ical.exportLoading')}
        </div>
      ) : exportUrl.isError || !url ? (
        <div className="space-y-2 rounded-md border border-destructive/40 p-3" role="alert">
          <p className="text-sm text-destructive">{t('ical.exportLoadError')}</p>
          <Button type="button" variant="outline" size="sm" onClick={() => void exportUrl.refetch()}>
            {t('ical.retry')}
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <Label htmlFor="property-ical-export">{t('ical.exportUrlLabel')}</Label>
          <div className="flex gap-2">
            <Input
              id="property-ical-export"
              ref={inputRef}
              readOnly
              value={url}
              onFocus={(e) => e.currentTarget.select()}
              className="font-mono text-xs"
            />
            <Button type="button" variant="outline" onClick={() => void handleCopy()}>
              {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
              {copied ? t('ical.copied') : t('ical.copy')}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">{t('ical.exportPrivate')}</p>
        </div>
      )}

      <div className="space-y-1 text-xs text-muted-foreground">
        <p className="font-medium text-foreground">{t('ical.exportHowTo')}</p>
        <ul className="list-disc space-y-1 pl-4">
          <li>
            <span className="font-medium text-foreground">{t('ical.channels.Airbnb')}</span>: {t('ical.exportAirbnbSteps')}
          </li>
          <li>
            <span className="font-medium text-foreground">{t('ical.channels.BookingCom')}</span>:{' '}
            {t('ical.exportBookingSteps')}
          </li>
        </ul>
        <p>{t('ical.exportRefreshNote')}</p>
      </div>
    </section>
  );
}
