import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
import { useMarkQuesturaCommunicationDone } from '@/queries/use-leases';
import { formatDate } from '@/lib/utils';
import { isStayDate, todayInRome } from '@/lib/stay-dates';
import { QUESTURA_MAX_RECEIPT_BYTES } from '@/lib/questura-communication';

interface QuesturaCommunicationDialogProps {
  leaseId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function isPdf(file: File): boolean {
  if (file.size === 0 || file.size > QUESTURA_MAX_RECEIPT_BYTES) return false;
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
}

/**
 * "Segna come comunicata" (LT-07): the landlord sent the communication to the public-security authority and declares
 * its date (not after today in Europe/Rome), with an optional receipt PDF, and confirms the declaration. Only this ticks
 * the checklist item. The server checks the date and the PDF content again.
 */
export function QuesturaCommunicationDialog({ leaseId, open, onOpenChange }: QuesturaCommunicationDialogProps) {
  const { t } = useTranslation();
  const markDone = useMarkQuesturaCommunicationDone();
  const today = todayInRome();
  const [communicationDate, setCommunicationDate] = useState(today);
  const [receipt, setReceipt] = useState<File | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  const dateValid = isStayDate(communicationDate) && communicationDate <= today;
  const receiptValid = receipt === null || isPdf(receipt);
  const canSubmit = dateValid && receiptValid && confirmed && !markDone.isPending;

  function reset() {
    setCommunicationDate(today);
    setReceipt(null);
    setConfirmed(false);
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  function handleSubmit() {
    if (!canSubmit) return;
    markDone.mutate(
      { id: leaseId, input: { communicationDate, receipt } },
      { onSuccess: () => handleOpenChange(false) },
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent data-testid="questura-mark-done-dialog">
        <DialogHeader>
          <DialogTitle>{t('leases.questura.dialog.title')}</DialogTitle>
          <DialogDescription>{t('leases.questura.dialog.description')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={`questura-date-${leaseId}`}>{t('leases.questura.dialog.dateLabel')}</Label>
            <Input
              id={`questura-date-${leaseId}`}
              type="date"
              value={communicationDate}
              max={today}
              onChange={(e) => setCommunicationDate(e.target.value)}
            />
            {!dateValid && (
              <p className="text-sm text-destructive" role="alert">
                {t('leases.questura.dialog.dateInvalid', { today: formatDate(today) })}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor={`questura-receipt-${leaseId}`}>{t('leases.questura.dialog.receiptLabel')}</Label>
            <Input
              id={`questura-receipt-${leaseId}`}
              type="file"
              accept="application/pdf,.pdf"
              onChange={(e) => setReceipt(e.target.files?.[0] ?? null)}
            />
            {!receiptValid && (
              <p className="text-sm text-destructive" role="alert">
                {t('leases.questura.dialog.receiptInvalid')}
              </p>
            )}
          </div>
          <div className="flex items-start gap-2">
            <Checkbox
              id={`questura-confirm-${leaseId}`}
              checked={confirmed}
              onCheckedChange={(value) => setConfirmed(value === true)}
            />
            <Label htmlFor={`questura-confirm-${leaseId}`} className="text-sm font-normal leading-snug">
              {t('leases.questura.dialog.confirmation')}
            </Label>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
            {t('leases.questura.dialog.cancel')}
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={!canSubmit}>
            {markDone.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('leases.questura.dialog.saving')}
              </>
            ) : (
              t('leases.questura.dialog.submit')
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
