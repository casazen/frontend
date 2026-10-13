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
import { useDeclareManualRegistration } from '@/queries/use-leases';
import { formatDate } from '@/lib/utils';
import { isStayDate, todayInRome } from '@/lib/stay-dates';
import { RLI_MAX_RECEIPT_BYTES, RLI_MAX_REGISTRATION_CODE_LENGTH } from '@/lib/rli-registration-state';

interface ManualRegistrationDialogProps {
  leaseId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function isPdf(file: File | null): file is File {
  if (!file || file.size === 0 || file.size > RLI_MAX_RECEIPT_BYTES) return false;
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
}

/**
 * Manual RLI registration (LT-01, D15): after registering the contract on the official channel of the Agenzia delle
 * Entrate the landlord enters the registration number or protocol, its date and the receipt PDF, and confirms the
 * declaration. Only then the lease becomes Registered. The server checks the PDF content and the date again.
 */
export function ManualRegistrationDialog({ leaseId, open, onOpenChange }: ManualRegistrationDialogProps) {
  const { t } = useTranslation();
  const declare = useDeclareManualRegistration();
  const today = todayInRome();
  const [registrationCode, setRegistrationCode] = useState('');
  const [registrationDate, setRegistrationDate] = useState(today);
  const [receipt, setReceipt] = useState<File | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  const code = registrationCode.trim();
  const codeValid = code.length > 0 && code.length <= RLI_MAX_REGISTRATION_CODE_LENGTH;
  const dateValid = isStayDate(registrationDate) && registrationDate <= today;
  const receiptValid = isPdf(receipt);
  const canSubmit = codeValid && dateValid && receiptValid && confirmed && !declare.isPending;

  function reset() {
    setRegistrationCode('');
    setRegistrationDate(today);
    setReceipt(null);
    setConfirmed(false);
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  function handleSubmit() {
    if (!canSubmit || !receipt) return;
    declare.mutate(
      { id: leaseId, input: { registrationCode: code, registrationDate, receipt } },
      { onSuccess: () => handleOpenChange(false) },
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent data-testid="rli-manual-dialog">
        <DialogHeader>
          <DialogTitle>{t('leases.rli.manualDialog.title')}</DialogTitle>
          <DialogDescription>{t('leases.rli.manualDialog.description')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={`rli-code-${leaseId}`}>{t('leases.rli.manualDialog.codeLabel')}</Label>
            <Input
              id={`rli-code-${leaseId}`}
              value={registrationCode}
              maxLength={RLI_MAX_REGISTRATION_CODE_LENGTH}
              onChange={(e) => setRegistrationCode(e.target.value)}
              aria-describedby={`rli-code-hint-${leaseId}`}
            />
            <p id={`rli-code-hint-${leaseId}`} className="text-xs text-muted-foreground">
              {t('leases.rli.manualDialog.codeHint')}
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`rli-date-${leaseId}`}>{t('leases.rli.manualDialog.dateLabel')}</Label>
            <Input
              id={`rli-date-${leaseId}`}
              type="date"
              value={registrationDate}
              max={today}
              onChange={(e) => setRegistrationDate(e.target.value)}
            />
            {!dateValid && (
              <p className="text-sm text-destructive" role="alert">
                {t('leases.rli.manualDialog.dateInvalid', { today: formatDate(today) })}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor={`rli-receipt-${leaseId}`}>{t('leases.rli.manualDialog.receiptLabel')}</Label>
            <Input
              id={`rli-receipt-${leaseId}`}
              type="file"
              accept="application/pdf,.pdf"
              onChange={(e) => setReceipt(e.target.files?.[0] ?? null)}
            />
            {receipt && !receiptValid && (
              <p className="text-sm text-destructive" role="alert">
                {t('leases.rli.manualDialog.receiptInvalid')}
              </p>
            )}
          </div>
          <div className="flex items-start gap-2">
            <Checkbox
              id={`rli-confirm-${leaseId}`}
              checked={confirmed}
              onCheckedChange={(value) => setConfirmed(value === true)}
            />
            <Label htmlFor={`rli-confirm-${leaseId}`} className="text-sm font-normal leading-snug">
              {t('leases.rli.manualDialog.confirmation')}
            </Label>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
            {t('leases.rli.manualDialog.cancel')}
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={!canSubmit}>
            {declare.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('leases.rli.manualDialog.saving')}
              </>
            ) : (
              t('leases.rli.manualDialog.submit')
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
