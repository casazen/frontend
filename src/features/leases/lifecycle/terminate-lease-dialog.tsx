import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ConfirmationDialog } from '@/components/shared/confirmation-dialog';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { addDays, isStayDate, parseStayDate } from '@/lib/stay-dates';
import { useLongRentRules } from '@/queries/use-lease-draft';
import { useTerminateLease } from '@/queries/use-lease-lifecycle';
import type { LeaseDetail } from '@/types';
import { leaseTermEnd, longDay, type LeaseSubject } from './lifecycle-format';

interface TerminateLeaseDialogProps {
  open: boolean;
  lease: LeaseDetail;
  subject: LeaseSubject;
  onClose: () => void;
}

/**
 * Ends a lease before the end of its period (LR-10, LR-TERM). It cannot be taken back, and it cancels the rent that has not been paid from
 * the day after the last one, so the window asks for the last day and for the word «TERMINA» before the button works (`ConfirmationDialog`
 * with `requireText`), says what follows in words, and the toast that follows has no «Annulla». The last day is any day after the start of
 * the lease and up to the end of the period it is in, a past one included: the first day is not an ending (the server refuses it, and
 * `min` of the field is the day after, so the picker never offers it). The facts a landlord needs are one sentence, with the months of
 * notice and the days to communicate it from the rules of the server (`GET /long-rent/rules`): no figure of law is written here.
 */
export function TerminateLeaseDialog({ open, lease, subject, onClose }: TerminateLeaseDialogProps) {
  const { t, i18n } = useTranslation();
  const terminate = useTerminateLease();
  const rules = useLongRentRules().data;
  const [on, setOn] = useState('');

  const start = parseStayDate(lease.startDate);
  const end = parseStayDate(leaseTermEnd(lease));
  // The first day that is an ending: the day after the lease began. A period of a single day (data written before this rule) has none.
  const min = start ? addDays(start, 1) : '';
  const hasRoom = min === '' || end === '' || min <= end;
  const dateValid = hasRoom && isStayDate(on) && (min === '' || on >= min) && (end === '' || on <= end);

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
        hint={hasRoom ? t('leaseLifecycle.terminate.dateHint', { from: longDay(min, i18n.language), to: longDay(end, i18n.language) }) : undefined}
        error={
          !hasRoom
            ? t('leaseLifecycle.terminate.noDay')
            : on !== '' && !dateValid
              ? t('leaseLifecycle.terminate.dateInvalid', { from: longDay(min, i18n.language), to: longDay(end, i18n.language) })
              : undefined
        }
      >
        <Input
          type="date"
          value={on}
          min={min || undefined}
          max={end || undefined}
          disabled={!hasRoom}
          onChange={(event) => setOn(event.target.value)}
          className="pointer-coarse:h-11"
          data-testid="lease-terminate-date"
        />
      </Field>
      {rules ? (
        <p className="text-sm text-muted-foreground" data-testid="lease-terminate-facts">
          {t('leaseLifecycle.terminate.facts', { notice: rules.noticeMonths, days: rules.registrationDays })}
        </p>
      ) : null}
    </ConfirmationDialog>
  );
}
