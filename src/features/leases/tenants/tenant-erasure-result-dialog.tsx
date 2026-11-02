import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { TenantErasureLease, TenantErasureResult } from '@/types';
import { fullDay } from '../lib/rent-register';

/** What the request did on one lease, in a sentence: done, done except for who has another lease, or set for the day after the lease ends. */
function leaseSentence(lease: TenantErasureLease, t: TFunction, language: string): string {
  switch (lease.status) {
    case 'Anonymized':
      return t('longRentTenants.privacy.result.anonymized');
    case 'PartiallyAnonymized':
      return t('longRentTenants.privacy.result.partial', { count: lease.partiesKept });
    case 'Scheduled': {
      const date = lease.anonymizationFrom ? fullDay(lease.anonymizationFrom, language) : '';
      return date ? t('longRentTenants.privacy.result.scheduled', { date }) : t('longRentTenants.privacy.result.scheduledNoDate');
    }
  }
}

interface TenantErasureResultDialogProps {
  /** The answer to show; `null` keeps the window closed. */
  result: TenantErasureResult | null;
  onClose: () => void;
}

/**
 * What the erasure request led to (LR-09), lease by lease, and kept on the screen until the person closes it: the request touches
 * personal data and cannot be taken back, so a toast that goes away in a few seconds is not enough to know what happened. A lease that
 * has not ended is not touched: the sentence says that its data stay until the day after it ends.
 */
export function TenantErasureResultDialog({ result, onClose }: TenantErasureResultDialogProps) {
  const { t, i18n } = useTranslation();

  return (
    <Dialog open={result !== null} onOpenChange={(next) => !next && onClose()}>
      <DialogContent data-testid="tenant-erasure-result">
        <DialogHeader>
          <DialogTitle>{t('longRentTenants.privacy.result.title')}</DialogTitle>
          <DialogDescription>{t('longRentTenants.privacy.result.description')}</DialogDescription>
        </DialogHeader>
        <ul role="list" className="grid gap-3 text-sm">
          {result?.leases.map((lease) => (
            <li key={lease.leaseId} className="min-w-0 break-words" data-testid="tenant-erasure-lease">
              <span className="font-medium">{lease.propertyName}</span>
              <span className="block text-foreground/80">{leaseSentence(lease, t, i18n.language)}</span>
            </li>
          ))}
        </ul>
        <DialogFooter>
          <Button type="button" onClick={onClose}>
            {t('shared.close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
