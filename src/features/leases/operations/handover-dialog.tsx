import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { leaseOperationsApi } from '@/api/lease-operations.api';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { isStayDate, parseStayDate } from '@/lib/stay-dates';
import type { LeaseDetail, LeaseOperations } from '@/types';
import { longDay } from '../lifecycle/lifecycle-format';
import { letterState } from './operations-model';
import { useLetterDownload } from './use-letter-download';

interface HandoverDialogProps {
  open: boolean;
  lease: LeaseDetail;
  operations: LeaseOperations;
  onClose: () => void;
}

function HandoverBody({ lease, operations, onClose }: Omit<HandoverDialogProps, 'open'>) {
  const { t, i18n } = useTranslation();
  const handover = operations.handover;
  const letter = letterState(operations, 'Riconsegna');
  const { busy, download } = useLetterDownload();

  const min = parseStayDate(handover.minOn);
  const max = parseStayDate(handover.maxOn);
  const [handoverOn, setHandoverOn] = useState(() => parseStayDate(handover.suggestedOn));
  const dateValid = handoverOn === '' || (isStayDate(handoverOn) && (min === '' || handoverOn >= min) && (max === '' || handoverOn <= max));

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <DialogHeader>
        <DialogTitle>{t('leaseOperations.handover.dialog.title')}</DialogTitle>
        <DialogDescription>{t('leaseOperations.handover.dialog.description')}</DialogDescription>
      </DialogHeader>

      <ol className="min-w-0 list-decimal space-y-1 pl-5 text-sm text-foreground/80" data-testid="handover-steps">
        <li>{t('leaseOperations.handover.dialog.steps.agree')}</li>
        <li>{t('leaseOperations.handover.dialog.steps.compare')}</li>
        <li>{t('leaseOperations.handover.dialog.steps.deposit')}</li>
      </ol>

      <Field
        label={t('leaseOperations.handover.dialog.dayLabel')}
        hint={t('leaseOperations.handover.dialog.dayHint')}
        error={!dateValid ? t('leaseOperations.handover.dialog.dayInvalid', { from: longDay(min, i18n.language), to: longDay(max, i18n.language) }) : undefined}
      >
        <Input
          type="date"
          value={handoverOn}
          min={min || undefined}
          max={max || undefined}
          onChange={(event) => setHandoverOn(event.target.value)}
          className="pointer-coarse:h-11"
          data-testid="handover-day"
        />
      </Field>

      {letter && !letter.approved ? (
        <p className="text-sm text-foreground/70" data-testid="handover-draft-note">
          {t('leaseOperations.draftNote')}
        </p>
      ) : null}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          {t('shared.close')}
        </Button>
        <Button
          type="button"
          loading={busy}
          disabled={!dateValid}
          onClick={() =>
            void download(
              () => leaseOperationsApi.downloadRiconsegna(lease.id, handoverOn === '' ? {} : { handoverOn }),
              `riconsegna-${lease.id}.pdf`,
            )
          }
          data-testid="handover-download"
        >
          {t('leaseOperations.handover.dialog.download')}
        </Button>
      </DialogFooter>
    </div>
  );
}

export function HandoverDialog({ open, lease, operations, onClose }: HandoverDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-h-[90dvh] sm:overflow-y-auto" data-testid="handover-dialog">
        <HandoverBody lease={lease} operations={operations} onClose={onClose} />
      </DialogContent>
    </Dialog>
  );
}
