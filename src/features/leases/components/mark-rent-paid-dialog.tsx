import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
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
import { Textarea } from '@/components/ui/textarea';
import { isStayDate, todayInRome } from '@/lib/stay-dates';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useMarkRentPaid } from '@/queries/use-rent';
import type { RentInstallment } from '@/types';

interface MarkRentPaidDialogProps {
  leaseId: string;
  /** The installment to declare paid; null closes the dialog. */
  installment: RentInstallment | null;
  onOpenChange: (open: boolean) => void;
}

const MAX_NOTE_LENGTH = 500;

/**
 * Offline payment of an installment (bank transfer, cash), declared by the landlord (LT-06). No money goes through
 * CasaZen; an online payment link still open is invalidated by the server first.
 */
export function MarkRentPaidDialog({ leaseId, installment, onOpenChange }: MarkRentPaidDialogProps) {
  const { t } = useTranslation();
  const markPaid = useMarkRentPaid(leaseId);
  const today = todayInRome();
  const [paidOn, setPaidOn] = useState(today);
  const [note, setNote] = useState('');

  const dateValid = isStayDate(paidOn) && paidOn <= today;
  const canSubmit = installment !== null && dateValid && note.length <= MAX_NOTE_LENGTH && !markPaid.isPending;

  function close() {
    setPaidOn(todayInRome());
    setNote('');
    onOpenChange(false);
  }

  function submit() {
    if (!canSubmit || !installment) return;
    markPaid.mutate(
      { installmentId: installment.id, input: { paidOn, note: note.trim() === '' ? undefined : note.trim() } },
      { onSuccess: close },
    );
  }

  return (
    <Dialog open={installment !== null} onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
      <DialogContent data-testid="mark-rent-paid-dialog">
        <DialogHeader>
          <DialogTitle>{t('rent.markPaidDialog.title')}</DialogTitle>
          <DialogDescription>
            {installment &&
              t('rent.markPaidDialog.description', {
                amount: formatCurrency(installment.amount, installment.currency),
                start: formatDate(installment.periodStart),
                end: formatDate(installment.periodEnd),
              })}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={`rent-paid-on-${leaseId}`}>{t('rent.markPaidDialog.paidOn')}</Label>
            <Input
              id={`rent-paid-on-${leaseId}`}
              type="date"
              value={paidOn}
              max={today}
              onChange={(e) => setPaidOn(e.target.value)}
            />
            {!dateValid && (
              <p className="text-sm text-destructive" role="alert">
                {t('rent.markPaidDialog.paidOnInvalid', { today: formatDate(today) })}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor={`rent-paid-note-${leaseId}`}>{t('rent.markPaidDialog.note')}</Label>
            <Textarea
              id={`rent-paid-note-${leaseId}`}
              value={note}
              maxLength={MAX_NOTE_LENGTH}
              placeholder={t('rent.markPaidDialog.notePlaceholder')}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={close}>
            {t('rent.cancel')}
          </Button>
          <Button type="button" onClick={submit} disabled={!canSubmit}>
            {markPaid.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('rent.markPaidDialog.submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
