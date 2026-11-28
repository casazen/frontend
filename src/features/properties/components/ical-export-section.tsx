import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarArrowUp, Check, Copy, Loader2, RotateCw } from 'lucide-react';
import { toast } from 'sonner';
import { InfoCard } from '@/components/shared/calm';
import { ManualHint } from '@/components/shared/manual-hint';
import { Button } from '@/components/ui/button';
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
import { getProblemMessage } from '@/lib/api-errors';
import { usePropertyIcalExportUrl, useRegeneratePropertyIcalExportUrl } from '@/queries/use-property-ical';

const COPIED_FEEDBACK_MS = 2_000;

export function IcalExportSection({ propertyId }: { propertyId: string }) {
  const { t } = useTranslation();
  const exportUrl = usePropertyIcalExportUrl(propertyId);
  const inputRef = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = useState(false);
  const [confirmRegenerate, setConfirmRegenerate] = useState(false);
  const regenerate = useRegeneratePropertyIcalExportUrl(propertyId);
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
      inputRef.current?.select();
      toast.error(t('ical.copyFailed'));
    }
  };

  const openRegenerate = () => {
    regenerate.reset();
    setConfirmRegenerate(true);
  };

  const closeRegenerate = () => {
    setConfirmRegenerate(false);
    regenerate.reset();
  };

  const confirm = () => {
    regenerate.mutate(undefined, {
      onSuccess: () => {
        setConfirmRegenerate(false);
        setCopied(false);
      },
    });
  };

  return (
    <InfoCard
      icon={CalendarArrowUp}
      title={t('ical.exportTitle')}
      hint={
        <ManualHint page="canali-octorate" anchor="incollare-il-link-di-casazen-sui-portali" title={t('ical.exportTitle')}>
          {t('ical.exportDescription')} {t('ical.exportPrivate')}
        </ManualHint>
      }
      data-testid="ical-export"
    >
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
          <Label htmlFor="property-ical-export" className="sr-only">
            {t('ical.exportUrlLabel')}
          </Label>
          <div className="flex gap-2">
            <Input
              id="property-ical-export"
              ref={inputRef}
              readOnly
              value={url}
              onFocus={(e) => e.currentTarget.select()}
              className="min-w-0 font-mono text-xs"
            />
            <Button type="button" variant="outline" size="icon" className="min-h-11 min-w-11 shrink-0" onClick={() => void handleCopy()}>
              {copied ? <Check aria-hidden="true" className="size-4" /> : <Copy aria-hidden="true" className="size-4" />}
              <span className="sr-only">{copied ? t('ical.copied') : t('ical.copy')}</span>
            </Button>
          </div>
          <div>
            <Button type="button" variant="ghost" size="sm" className="-ms-2 min-h-11 px-2" onClick={openRegenerate}>
              <RotateCw aria-hidden="true" className="size-4" />
              {t('ical.regenerate')}
            </Button>
          </div>
        </div>
      )}

      <Dialog open={confirmRegenerate} onOpenChange={(open) => !open && closeRegenerate()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('ical.regenerateTitle')}</DialogTitle>
            <DialogDescription>{t('ical.regenerateDescription')}</DialogDescription>
          </DialogHeader>
          {regenerate.isError && (
            <p className="text-sm text-destructive" role="alert">
              {getProblemMessage(regenerate.error, t) ?? t('ical.regenerateFailed')}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeRegenerate}>
              {t('ical.cancel')}
            </Button>
            <Button type="button" variant="destructive" onClick={confirm} disabled={regenerate.isPending}>
              {regenerate.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('ical.regenerateConfirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </InfoCard>
  );
}
