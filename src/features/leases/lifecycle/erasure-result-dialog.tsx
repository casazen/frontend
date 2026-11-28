import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { LeaseErasureResult } from '@/types';
import { longDay } from './lifecycle-format';

function erasureSentence(result: LeaseErasureResult, t: TFunction, language: string): string {
  switch (result.status) {
    case 'Anonymized':
      return t('leaseLifecycle.erasure.result.anonymized');
    case 'PartiallyAnonymized':
      return t('leaseLifecycle.erasure.result.partial', { count: result.partiesKept });
    case 'Scheduled': {
      const date = longDay(result.anonymizationFrom, language);
      return date ? t('leaseLifecycle.erasure.result.scheduled', { date }) : t('leaseLifecycle.erasure.result.scheduledNoDate');
    }
  }
}

interface ErasureResultDialogProps {
  result: LeaseErasureResult | null;
  onClose: () => void;
}

export function ErasureResultDialog({ result, onClose }: ErasureResultDialogProps) {
  const { t, i18n } = useTranslation();

  return (
    <Dialog open={result !== null} onOpenChange={(next) => !next && onClose()}>
      <DialogContent data-testid="lease-erasure-result">
        <DialogHeader>
          <DialogTitle>{t('leaseLifecycle.erasure.result.title')}</DialogTitle>
          <DialogDescription>{result ? erasureSentence(result, t, i18n.language) : ''}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" onClick={onClose}>
            {t('shared.close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
