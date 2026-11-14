import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle, Download } from 'lucide-react';
import { ConfirmationDialog } from '@/components/shared/confirmation-dialog';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useOwnerFormat } from '@/features/owner-accounting/use-owner-format';
import { batchReference, failureMessage } from '@/lib/agency-finance';
import { useConfirmDownload, useConfirmPaid, useDownloadBatchFile } from '@/queries/wireTransfer';
import type { WireBatch, WireBatchStatus } from '@/types';
import { WireAmount } from './wire-amount';
import { withoutIban } from './wire-model';

interface WireBatchCardProps {
  batch: WireBatch;
}

const STATUS_CLASS: Record<WireBatchStatus, string> = {
  Generated: 'bg-blue-100 text-blue-800',
  Downloaded: 'bg-yellow-100 text-yellow-800',
  Paid: 'bg-green-100 text-green-800',
};

const isKnownStatus = (status: string): status is WireBatchStatus => status === 'Generated' || status === 'Downloaded' || status === 'Paid';

/**
 * A wire file of the agency, from the list of the server (ADR-017, E16): the date, the currency, the number of transfers, the total and where it is. The step shown is the
 * server's, never a guess: the card asks the server again after each request, so whatever someone else did to the file shows too. The three steps are the person's: the file is
 * handed out («file per la banca», the server marks it downloaded the first time), the person may say it is downloaded, and «paid» only after the administrator confirmed it and
 * the server accepted. «Paid» is the administrator's word: CasaZen does not know whether the bank executed the transfers, and the card says so. Marking it paid cannot be
 * undone, so it asks to be confirmed with the file, the amount and the currency. The card owns its requests: while any of them is on its way every button of the card waits,
 * and an answer of the server that contradicts what the card shows (already paid, never downloaded, a payout reversed since) is told in words, then the list corrects the step.
 */
export function WireBatchCard({ batch }: WireBatchCardProps) {
  const { t } = useTranslation();
  const format = useOwnerFormat();
  const download = useDownloadBatchFile();
  const confirmDownload = useConfirmDownload();
  const confirmPaid = useConfirmPaid();
  const [failure, setFailure] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  // A request is on its way: the state of the mutation says it a moment later than the click, so a second one in between is stopped here.
  const sending = useRef(false);

  const busy = download.isPending || confirmDownload.isPending || confirmPaid.isPending;
  const reference = batchReference(batch.id);
  const status = batch.status;
  const known = isKnownStatus(status);

  /** One request of the card at a time. Whatever the answer, what the server says is told in words and the list is read again by the mutation itself. */
  const run = async (request: () => Promise<unknown>, fallback: string) => {
    if (busy || sending.current) return;
    sending.current = true;
    setFailure(null);
    try {
      await request();
    } catch (error) {
      setFailure(withoutIban(failureMessage(error, t, fallback, t('wire.batch.notFound'))));
    } finally {
      sending.current = false;
    }
  };

  const onDownload = () =>
    run(async () => {
      try {
        await download.mutateAsync({ batchId: batch.id, fallbackName: `wire-batch-${batch.id}-${batch.currency}.xml` });
      } finally {
        download.reset();
      }
    }, t('wire.batch.downloadError'));

  const onConfirmDownload = () =>
    run(async () => {
      try {
        await confirmDownload.mutateAsync(batch.id);
      } finally {
        confirmDownload.reset();
      }
    }, t('wire.batch.confirmDownloadedError'));

  /** Marked as paid by the administrator's word, after the confirmation. */
  const onMarkPaid = () =>
    run(async () => {
      try {
        await confirmPaid.mutateAsync(batch.id);
      } finally {
        confirmPaid.reset();
      }
    }, t('wire.batch.confirmPaidError'));

  const dismissConfirmation = (open: boolean) => {
    // The request is on its way: the dialog stays until the server has answered, so nobody confirms the same payment twice.
    if (!open && !busy) setConfirming(false);
  };

  const paidOn = batch.paidAt ? format.dateTime(batch.paidAt) : '';

  return (
    <div className="space-y-4 rounded-lg border p-4" data-testid={`wire-batch-${batch.id}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-mono text-sm" data-testid="wire-batch-reference">
          {reference}
        </p>
        <span
          data-testid="wire-batch-status"
          data-status={status}
          className={`rounded-full px-2 py-1 text-xs font-medium ${known ? STATUS_CLASS[status] : 'bg-muted text-foreground'}`}
        >
          {known ? t(`wire.status.${status.toLowerCase()}`) : t('wire.status.unknown')}
        </span>
      </div>

      <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-muted-foreground">{t('wire.batch.createdAt')}</dt>
          <dd className="font-medium" data-testid="wire-batch-created">
            {format.dateTime(batch.createdAt)}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t('wire.batch.executionDate')}</dt>
          <dd className="font-medium" data-testid="wire-batch-execution">
            {batch.executionDate ? format.date(batch.executionDate) : t('wire.batch.noExecutionDate')}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t('wire.batch.currency')}</dt>
          <dd className="font-medium" data-testid="wire-batch-currency">
            {batch.currency}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t('wire.batch.transferCount')}</dt>
          <dd className="font-medium" data-testid="wire-batch-count">
            {batch.transferCount}
          </dd>
        </div>
        <div className="col-span-2 sm:col-span-4">
          <dt className="text-muted-foreground">{t('wire.batch.totalAmount')}</dt>
          <dd className="text-base font-semibold">
            <WireAmount amount={batch.totalAmount} currency={batch.currency} testId="wire-batch-amount" />
          </dd>
        </div>
      </dl>

      {failure && (
        <Alert variant="danger" data-testid="wire-batch-failure">
          {failure}
        </Alert>
      )}

      {status === 'Paid' ? (
        <Alert variant="success" icon={CheckCircle} data-testid="wire-batch-paid">
          {paidOn ? t('wire.batch.paidCompleteOn', { date: paidOn }) : t('wire.batch.paidComplete')}
        </Alert>
      ) : (
        <p className="text-sm text-muted-foreground" data-testid="wire-batch-next">
          {status === 'Generated' ? t('wire.batch.nextDownload') : status === 'Downloaded' ? t('wire.batch.nextUpload') : t('wire.batch.nextUnknown')}
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <Button onClick={() => void onDownload()} disabled={busy} variant={status === 'Generated' ? 'default' : 'outline'} data-testid="wire-batch-download">
          <Download className="mr-2 h-4 w-4" />
          {t('wire.batch.download')}
        </Button>
        {status === 'Generated' && (
          <Button onClick={() => void onConfirmDownload()} disabled={busy} variant="outline" data-testid="wire-batch-confirm-downloaded">
            {t('wire.batch.confirmDownloaded')}
          </Button>
        )}
        {status !== 'Paid' && (
          <Button onClick={() => setConfirming(true)} disabled={busy || status !== 'Downloaded'} data-testid="wire-batch-confirm-paid">
            <CheckCircle className="mr-2 h-4 w-4" />
            {t('wire.batch.confirmPaid')}
          </Button>
        )}
      </div>

      <ConfirmationDialog
        open={confirming}
        onOpenChange={dismissConfirmation}
        title={t('wire.batch.confirmPaidTitle')}
        description={t('wire.batch.confirmPaidDescription', { reference })}
        consequences={[t('wire.batch.consequenceWord'), t('wire.batch.consequenceFinal')]}
        confirmLabel={t('wire.batch.confirmPaid')}
        isLoading={busy}
        onConfirm={onMarkPaid}
      >
        <dl className="grid grid-cols-2 gap-3 rounded-md bg-muted/50 p-3 text-sm" data-testid="wire-confirm-summary">
          <div>
            <dt className="text-muted-foreground">{t('wire.batch.id')}</dt>
            <dd className="font-mono">{reference}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t('wire.batch.currency')}</dt>
            <dd className="font-medium" data-testid="wire-confirm-currency">
              {batch.currency}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t('wire.batch.totalAmount')}</dt>
            <dd className="font-semibold">
              <WireAmount amount={batch.totalAmount} currency={batch.currency} testId="wire-confirm-amount" />
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t('wire.batch.transferCount')}</dt>
            <dd className="font-medium">{batch.transferCount}</dd>
          </div>
        </dl>
      </ConfirmationDialog>
    </div>
  );
}
