import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ChoiceCard, ChoiceGroup } from '@/components/ui/choice-card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { isStayDate, parseStayDate, todayInRome } from '@/lib/stay-dates';
import { toastUndo } from '@/lib/toast-undo';
import { useLeaseLifecycleActions, useRecordLeaseNotice } from '@/queries/use-lease-lifecycle';
import type { LeaseDetail, LeaseNoticeParty } from '@/types';
import { leaseTermEnd, longDay, type LeaseSubject } from './lifecycle-format';

interface RecordNoticeDialogProps {
  open: boolean;
  lease: LeaseDetail;
  subject: LeaseSubject;
  onClose: () => void;
}

function NoticeForm({ lease, subject, onClose }: Omit<RecordNoticeDialogProps, 'open'>) {
  const { t, i18n } = useTranslation();
  const record = useRecordLeaseNotice();
  const actions = useLeaseLifecycleActions();
  const today = todayInRome();
  const start = parseStayDate(lease.startDate);
  const [from, setFrom] = useState<LeaseNoticeParty | null>(null);
  const [on, setOn] = useState('');

  // From the first day of the lease up to today: the server refuses any other day.
  const dateValid = isStayDate(on) && on <= today && (start === '' || on >= start);

  /** Said once the notice is recorded: where the lease ends now, that it may have come late (without a figure) and, if it can be, «Annulla». */
  function announce(detail: LeaseDetail) {
    const message = t('leaseLifecycle.notice.recorded', { date: longDay(leaseTermEnd(detail), i18n.language) });
    const description = detail.noticeWarning ? t('leaseLifecycle.notice.possiblyLate') : undefined;
    // The server takes a notice back only while the period has not ended: after that «Annulla» would promise what cannot be done.
    if (parseStayDate(leaseTermEnd(detail)) < todayInRome()) {
      toast.success(message, { description });
      return;
    }
    toastUndo(message, {
      description,
      undo: async () => {
        await actions.removeNotice(lease.id);
        toast.info(t('leaseLifecycle.notice.removed'));
      },
    });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    // The window is drawn outside the page but sits inside it for React: the submit must not go on to a form around the page.
    event.stopPropagation();
    if (from === null || !dateValid || record.isPending) return;
    let detail: LeaseDetail;
    try {
      detail = await record.mutateAsync({ leaseId: lease.id, input: { from, on } });
    } catch {
      return; // The hook told why and read the lease again: the window stays, with what was typed.
    }
    onClose();
    announce(detail);
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-4" noValidate>
      <DialogHeader>
        <DialogTitle>{t('leaseLifecycle.notice.title')}</DialogTitle>
        <DialogDescription>{t('leaseLifecycle.notice.description', subject)}</DialogDescription>
      </DialogHeader>

      <ChoiceGroup legend={t('leaseLifecycle.notice.fromLegend')} legendVisible>
        <ChoiceCard
          name="lease-notice-from"
          value="Tenant"
          checked={from === 'Tenant'}
          onChange={() => setFrom('Tenant')}
          title={t('leaseLifecycle.notice.fromTenant')}
        />
        <ChoiceCard
          name="lease-notice-from"
          value="Landlord"
          checked={from === 'Landlord'}
          onChange={() => setFrom('Landlord')}
          title={t('leaseLifecycle.notice.fromLandlord')}
        />
      </ChoiceGroup>

      <Field
        label={t('leaseLifecycle.notice.dateLabel')}
        hint={t('leaseLifecycle.notice.dateHint')}
        error={on !== '' && !dateValid ? t('leaseLifecycle.notice.dateInvalid') : undefined}
      >
        <Input
          type="date"
          value={on}
          min={start || undefined}
          max={today}
          onChange={(event) => setOn(event.target.value)}
          className="pointer-coarse:h-11"
          data-testid="lease-notice-date"
        />
      </Field>

      <div className="space-y-1 text-sm text-foreground/70" data-testid="lease-notice-explanation">
        <p>{t('leaseLifecycle.notice.renews')}</p>
        <p>{t('leaseLifecycle.notice.ends', { date: longDay(leaseTermEnd(lease), i18n.language) })}</p>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose} disabled={record.isPending}>
          {t('shared.cancel')}
        </Button>
        <Button type="submit" loading={record.isPending} disabled={from === null || !dateValid}>
          {t('leaseLifecycle.notice.confirm')}
        </Button>
      </DialogFooter>
    </form>
  );
}

/**
 * Records the notice of non-renewal that the tenant or the landlord gave (LR-10): who gave it and the day, and the two lines that say what
 * it means. The window is controlled by the address (`?azione=disdetta`), stays mounted and shows its form only while open, so what was
 * typed is forgotten at closing. Nothing is sent to anyone: CasaZen records the notice, and says when it may have come too late without
 * judging whether it is valid (LR-D29).
 */
export function RecordNoticeDialog({ open, lease, subject, onClose }: RecordNoticeDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent data-testid="lease-notice-dialog">
        <NoticeForm lease={lease} subject={subject} onClose={onClose} />
      </DialogContent>
    </Dialog>
  );
}
