import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ConfirmationDialog } from '@/components/shared/confirmation-dialog';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { isStayDate, parseStayDate } from '@/lib/stay-dates';
import { useTerminateLease } from '@/queries/use-lease-lifecycle';
import type { LeaseDetail } from '@/types';
import { longDay, type LeaseSubject } from './lifecycle-format';

interface TerminateLeaseDialogProps {
  open: boolean;
  lease: LeaseDetail;
  subject: LeaseSubject;
  onClose: () => void;
}

/**
 * Ends a lease before the end of its period (LR-10). It cannot be taken back, and it cancels the rent that has not been paid from the day
 * after the last one, so the window asks for the last day and for the word «TERMINA» before the button works (`ConfirmationDialog`
 * with `requireText`), says what follows in words (no figure and no deadline: those are the legal's), and the toast that follows has no
 * «Annulla». The last day is any day from the start of the lease to the end of the period it is in, a past one included.
 */
export function TerminateLeaseDialog({ open, lease, subject, onClose }: TerminateLeaseDialogProps) {
  const { t, i18n } = useTranslation();
  const terminate = useTerminateLease();
  const [on, setOn] = useState('');

  const start = parseStayDate(lease.startDate);
  const end = parseStayDate(lease.currentTermEndDate ?? lease.endDate);
  const dateValid = isStayDate(on) && (start === '' || on >= start) && (end === '' || on <= end);

  function close() {
    setOn('');
    onClose();
  }

  async function confirm() {
    if (!dateValid) return;
    try {
      await terminate.mutateAsync({ leaseId: lease.id, input: { on } });
    } catch {
      return; // The hook told why and read the lease again.
    }
    toast.success(t('leaseLifecycle.terminate.done', { date: longDay(on, i18n.language) }));
  }

  return (
    <ConfirmationDialog
      open={open}
      onOpenChange={(next) => !next && close()}
      title={t('leaseLifecycle.terminate.title')}
      description={t('leaseLifecycle.terminate.description', subject)}
      variant="destructive"
      confirmLabel={t('leaseLifecycle.terminate.confirm')}
      requireText={t('leaseLifecycle.terminate.word')}
      consequences={[
        t('leaseLifecycle.terminate.consequences.rent'),
        t('leaseLifecycle.terminate.consequences.property'),
        t('leaseLifecycle.terminate.consequences.revenue'),
        t('leaseLifecycle.terminate.consequences.final'),
      ]}
      confirmDisabled={!dateValid}
      isLoading={terminate.isPending}
      onConfirm={confirm}
    >
      <Field
        label={t('leaseLifecycle.terminate.dateLabel')}
        hint={t('leaseLifecycle.terminate.dateHint')}
        error={on !== '' && !dateValid ? t('leaseLifecycle.terminate.dateInvalid') : undefined}
      >
        <Input
          type="date"
          value={on}
          min={start || undefined}
          max={end || undefined}
          onChange={(event) => setOn(event.target.value)}
          className="pointer-coarse:h-11"
          data-testid="lease-terminate-date"
        />
      </Field>
    </ConfirmationDialog>
  );
}
