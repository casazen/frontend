import { useTranslation } from 'react-i18next';
import { leaseOperationsApi } from '@/api/lease-operations.api';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { LeaseDetail, LeaseOperations } from '@/types';
import { Disclosure } from '../guide/disclosure';
import { longDay } from '../lifecycle/lifecycle-format';
import { LetterSentForm } from './letter-sent-form';
import { letterState } from './operations-model';
import { useLetterDownload } from './use-letter-download';

interface NeedConfirmationDialogProps {
  open: boolean;
  lease: LeaseDetail;
  operations: LeaseOperations;
  onClose: () => void;
}

function NeedConfirmationBody({ lease, operations, onClose }: Omit<NeedConfirmationDialogProps, 'open'>) {
  const { t, i18n } = useTranslation();
  const { transitoryConfirmation: confirmation } = operations;
  const letter = letterState(operations, 'ConfermaEsigenza');
  const { busy, download } = useLetterDownload();

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <DialogHeader>
        <DialogTitle>{t('leaseOperations.needConfirmation.dialog.title')}</DialogTitle>
        <DialogDescription>{t('leaseOperations.needConfirmation.dialog.description')}</DialogDescription>
      </DialogHeader>

      <ul role="list" className="min-w-0 space-y-1 text-sm text-foreground/80" data-testid="need-confirmation-facts">
        <li>{t('leaseOperations.needConfirmation.dialog.deadline', { date: longDay(confirmation.confirmBy, i18n.language) })}</li>
        <li>{t('leaseOperations.needConfirmation.dialog.effects')}</li>
      </ul>

      {letter && !letter.approved ? (
        <p className="text-sm text-foreground/70" data-testid="need-confirmation-draft-note">
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
          onClick={() => void download(() => leaseOperationsApi.downloadConfermaEsigenza(lease.id), `conferma-esigenza-${lease.id}.pdf`)}
          data-testid="need-confirmation-download"
        >
          {t('leaseOperations.download.label')}
        </Button>
      </DialogFooter>

      <Disclosure summary={t('leaseOperations.sent.title')} testId="need-confirmation-after">
        <LetterSentForm leaseId={lease.id} startDate={lease.startDate} kind="ConfermaEsigenza" sent={letter?.sent ?? null} />
      </Disclosure>
    </div>
  );
}

/**
 * «Conferma l'esigenza» (LR-OPS-1b): the window of the landlord's confirmation that the need of a transitory lease goes on. It says by which
 * day the letter has to be sent (the last day of the contract: the files of the project say only «before the end», and the exact term is the
 * accountant's to confirm) and downloads the draft of the letter, a PDF the person signs and sends. After sending, «Segna come inviata» is
 * one click below. It is only offered when the need is the landlord's; when it is the tenant's, the tenant confirms it. The window is
 * controlled by the address (`?operazione=conferma-esigenza`), and its content is forgotten when it closes.
 */
export function NeedConfirmationDialog({ open, lease, operations, onClose }: NeedConfirmationDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-h-[90dvh] sm:overflow-y-auto" data-testid="need-confirmation-dialog">
        <NeedConfirmationBody lease={lease} operations={operations} onClose={onClose} />
      </DialogContent>
    </Dialog>
  );
}
