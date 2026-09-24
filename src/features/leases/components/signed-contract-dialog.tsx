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
import { useDeclareOfflineSignature } from '@/queries/use-leases';
import { formatDate } from '@/lib/utils';
import { isStayDate, todayInRome } from '@/lib/stay-dates';
import { isPdfFile, LEASE_MAX_SIGNED_CONTRACT_BYTES } from '@/lib/lease-signing';

interface SignedContractDialogProps {
  leaseId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Offline signature (LT-02, D15): the landlord uploads the contract signed by every party (PDF) and declares the
 * stipula date, the day the last party signed. Only then the lease becomes Signed and the RLI deadline is fixed. The
 * server checks the PDF content, its size and the date again.
 */
export function SignedContractDialog({ leaseId, open, onOpenChange }: SignedContractDialogProps) {
  const { t } = useTranslation();
  const declare = useDeclareOfflineSignature();
  const today = todayInRome();
  const [stipulaDate, setStipulaDate] = useState(today);
  const [signedContract, setSignedContract] = useState<File | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  const dateValid = isStayDate(stipulaDate) && stipulaDate <= today;
  const fileValid = isPdfFile(signedContract, LEASE_MAX_SIGNED_CONTRACT_BYTES);
  const canSubmit = dateValid && fileValid && confirmed && !declare.isPending;

  function reset() {
    setStipulaDate(today);
    setSignedContract(null);
    setConfirmed(false);
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  function handleSubmit() {
    if (!canSubmit || !signedContract) return;
    declare.mutate(
      { id: leaseId, input: { stipulaDate, signedContract } },
      { onSuccess: () => handleOpenChange(false) },
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent data-testid="signed-contract-dialog">
        <DialogHeader>
          <DialogTitle>{t('leases.signature.uploadDialog.title')}</DialogTitle>
          <DialogDescription>{t('leases.signature.uploadDialog.description')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={`signed-contract-${leaseId}`}>{t('leases.signature.uploadDialog.fileLabel')}</Label>
            <Input
              id={`signed-contract-${leaseId}`}
              type="file"
              accept="application/pdf,.pdf"
              onChange={(e) => setSignedContract(e.target.files?.[0] ?? null)}
            />
            {signedContract && !fileValid && (
              <p className="text-sm text-destructive" role="alert">
                {t('leases.signature.uploadDialog.fileInvalid')}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor={`stipula-date-${leaseId}`}>{t('leases.signature.stipulaDateLabel')}</Label>
            <Input
              id={`stipula-date-${leaseId}`}
              type="date"
              value={stipulaDate}
              max={today}
              onChange={(e) => setStipulaDate(e.target.value)}
              aria-describedby={`stipula-date-hint-${leaseId}`}
            />
            <p id={`stipula-date-hint-${leaseId}`} className="text-xs text-muted-foreground">
              {t('leases.signature.stipulaDateHint')}
            </p>
            {!dateValid && (
              <p className="text-sm text-destructive" role="alert">
                {t('leases.signature.stipulaDateInvalid', { today: formatDate(today) })}
              </p>
            )}
          </div>
          <div className="flex items-start gap-2">
            <Checkbox
              id={`signed-contract-confirm-${leaseId}`}
              checked={confirmed}
              onCheckedChange={(value) => setConfirmed(value === true)}
            />
            <Label htmlFor={`signed-contract-confirm-${leaseId}`} className="text-sm font-normal leading-snug">
              {t('leases.signature.uploadDialog.confirmation')}
            </Label>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
            {t('leases.signature.cancel')}
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={!canSubmit}>
            {declare.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('leases.signature.saving')}
              </>
            ) : (
              t('leases.signature.uploadDialog.submit')
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
