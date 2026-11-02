import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { leaseOperationsApi } from '@/api/lease-operations.api';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Select } from '@/components/ui/select';
import type { LeaseDetail, LeaseDisdettaReason, LeaseOperations } from '@/types';
import { Disclosure } from '../guide/disclosure';
import { leaseSheetPath } from '../lib/lease-next-step';
import { LEASE_ACTION_PARAM } from '../lifecycle/lifecycle-actions';
import { longDay } from '../lifecycle/lifecycle-format';
import { LetterSentForm } from './letter-sent-form';
import { letterState } from './operations-model';
import { useLetterDownload } from './use-letter-download';

interface DisdettaDialogProps {
  open: boolean;
  lease: LeaseDetail;
  operations: LeaseOperations;
  onClose: () => void;
}

function DisdettaBody({ lease, operations, onClose }: Omit<DisdettaDialogProps, 'open'>) {
  const { t, i18n } = useTranslation();
  const { disdetta } = operations;
  const letter = letterState(operations, 'Disdetta');
  const { busy, download } = useLetterDownload();
  const [reason, setReason] = useState<LeaseDisdettaReason | ''>('');

  // At the first expiry the law asks the letter to state one of its reasons: no letter without one.
  const needsReason = disdetta.firstPeriod;
  const canDownload = !needsReason || reason !== '';
  const recordPath = `${leaseSheetPath(lease.id)}?${LEASE_ACTION_PARAM}=disdetta`;

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <DialogHeader>
        <DialogTitle>{t('leaseOperations.disdetta.dialog.title')}</DialogTitle>
        <DialogDescription>{t('leaseOperations.disdetta.dialog.description')}</DialogDescription>
      </DialogHeader>

      <ul role="list" className="min-w-0 space-y-1 text-sm text-foreground/80" data-testid="disdetta-facts">
        <li>{t('leaseOperations.disdetta.dialog.ends', { date: longDay(disdetta.periodEnd, i18n.language) })}</li>
        {disdetta.lastDayToGiveNotice ? (
          <li className={disdetta.late ? 'font-medium text-foreground' : undefined}>
            {t(disdetta.late ? 'leaseOperations.disdetta.dialog.late' : 'leaseOperations.disdetta.dialog.lastDay', {
              date: longDay(disdetta.lastDayToGiveNotice, i18n.language),
            })}
          </li>
        ) : null}
      </ul>

      {needsReason ? (
        <Field label={t('leaseOperations.disdetta.dialog.reasonLabel')} hint={t('leaseOperations.disdetta.dialog.reasonHint')}>
          <Select
            value={reason}
            onChange={(event) => setReason(event.target.value as LeaseDisdettaReason | '')}
            className="pointer-coarse:h-11"
            data-testid="disdetta-reason"
          >
            <option value="">{t('leaseOperations.disdetta.dialog.reasonPlaceholder')}</option>
            {disdetta.reasons.map((option) => (
              <option key={option} value={option}>
                {t(`leaseOperations.reasons.${option}`)}
              </option>
            ))}
          </Select>
        </Field>
      ) : (
        <p className="text-sm text-foreground/70">{t('leaseOperations.disdetta.dialog.laterPeriod')}</p>
      )}

      {letter && !letter.approved ? (
        <p className="text-sm text-foreground/70" data-testid="disdetta-draft-note">
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
          disabled={!canDownload}
          onClick={() =>
            void download(
              () => leaseOperationsApi.downloadDisdetta(lease.id, needsReason && reason !== '' ? { reason } : {}),
              `disdetta-${lease.id}.pdf`,
            )
          }
          data-testid="disdetta-download"
        >
          {t('leaseOperations.download.label')}
        </Button>
      </DialogFooter>

      <Disclosure summary={t('leaseOperations.sent.title')} testId="disdetta-after">
        <LetterSentForm leaseId={lease.id} startDate={lease.startDate} kind="Disdetta" sent={letter?.sent ?? null} />
        {lease.noticeOn ? null : (
          <p className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-foreground/80">
            <span className="break-words">{t('leaseOperations.disdetta.dialog.recordHint')}</span>
            <Link to={recordPath} className="font-medium text-primary-text underline underline-offset-2" data-testid="disdetta-record-link">
              {t('leaseOperations.disdetta.dialog.recordAction')}
            </Link>
          </p>
        )}
      </Disclosure>
    </div>
  );
}

/**
 * «Prepara la disdetta» (LR-OPS-1): the window of the landlord's notice of non-renewal. It says when the lease ends and by which day the
 * letter is on time (computed by the server, no month of law is written here), asks for the reason of the law at the first expiry (the
 * only field) and downloads the draft of the letter, a PDF the person signs and sends. After sending, «Segna come inviata» and the way to
 * record the notice in the contract (the action that stops the renewal) are one click below. The window is controlled by the address
 * (`?operazione=disdetta`), and its content is forgotten when it closes.
 */
export function DisdettaDialog({ open, lease, operations, onClose }: DisdettaDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-h-[90dvh] sm:overflow-y-auto" data-testid="disdetta-dialog">
        <DisdettaBody lease={lease} operations={operations} onClose={onClose} />
      </DialogContent>
    </Dialog>
  );
}
