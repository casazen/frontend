import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { leaseOperationsApi } from '@/api/lease-operations.api';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { isStayDate, parseStayDate } from '@/lib/stay-dates';
import type { LeaseDetail, LeaseOperations } from '@/types';
import { Disclosure } from '../guide/disclosure';
import { longDay } from '../lifecycle/lifecycle-format';
import { LetterSentForm } from './letter-sent-form';
import { letterState } from './operations-model';
import { useLetterDownload } from './use-letter-download';

interface CedolareDialogProps {
  open: boolean;
  lease: LeaseDetail;
  operations: LeaseOperations;
  onClose: () => void;
}

function CedolareBody({ lease, operations, onClose }: Omit<CedolareDialogProps, 'open'>) {
  const { t, i18n } = useTranslation();
  const letter = letterState(operations, 'OpzioneCedolare');
  const { busy, download } = useLetterDownload();
  const [effectiveFrom, setEffectiveFrom] = useState('');

  const min = parseStayDate(operations.cedolareNotice.minEffectiveOn);
  const max = parseStayDate(operations.cedolareNotice.maxEffectiveOn);
  // The day is optional: without it the letter leaves it to complete. A day that is typed has to be one the contract has.
  const dateValid = effectiveFrom === '' || (isStayDate(effectiveFrom) && (min === '' || effectiveFrom >= min) && (max === '' || effectiveFrom <= max));

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <DialogHeader>
        <DialogTitle>{t('leaseOperations.cedolare.dialog.title')}</DialogTitle>
        <DialogDescription>{t('leaseOperations.cedolare.dialog.description')}</DialogDescription>
      </DialogHeader>

      <p className="text-sm text-foreground/80" data-testid="cedolare-note">
        {t('leaseOperations.cedolare.dialog.note')}
      </p>

      <Field
        label={t('leaseOperations.cedolare.dialog.effectiveLabel')}
        hint={t('leaseOperations.cedolare.dialog.effectiveHint')}
        error={!dateValid ? t('leaseOperations.cedolare.dialog.effectiveInvalid', { from: longDay(min, i18n.language), to: longDay(max, i18n.language) }) : undefined}
      >
        <Input
          type="date"
          value={effectiveFrom}
          min={min || undefined}
          max={max || undefined}
          onChange={(event) => setEffectiveFrom(event.target.value)}
          className="pointer-coarse:h-11"
          data-testid="cedolare-effective"
        />
      </Field>

      {letter && !letter.approved ? (
        <p className="text-sm text-foreground/70" data-testid="cedolare-draft-note">
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
              () => leaseOperationsApi.downloadOpzioneCedolare(lease.id, effectiveFrom === '' ? {} : { effectiveFrom }),
              `opzione-cedolare-${lease.id}.pdf`,
            )
          }
          data-testid="cedolare-download"
        >
          {t('leaseOperations.download.label')}
        </Button>
      </DialogFooter>

      <Disclosure summary={t('leaseOperations.sent.title')} testId="cedolare-after">
        <LetterSentForm leaseId={lease.id} startDate={lease.startDate} kind="OpzioneCedolare" sent={letter?.sent ?? null} />
      </Disclosure>
    </div>
  );
}

/**
 * «Comunica la cedolare secca» (LR-OPS-1c): the window of the landlord's communication to the tenant that he has chosen the cedolare secca, with
 * the renunciation of every update of the rent for as long as the option lasts. One optional field (the first day the option applies from) and
 * the draft of the letter to download, to send by registered mail. A contract made in CasaZen already says it in a clause, so the window says that
 * the letter is for another contract or an option chosen later. Controlled by the address (`?operazione=cedolare`); nothing is sent from here.
 */
export function CedolareDialog({ open, lease, operations, onClose }: CedolareDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-h-[90dvh] sm:overflow-y-auto" data-testid="cedolare-dialog">
        <CedolareBody lease={lease} operations={operations} onClose={onClose} />
      </DialogContent>
    </Dialog>
  );
}
