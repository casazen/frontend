import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle, Download } from 'lucide-react';
import { ConfirmationDialog } from '@/components/shared/confirmation-dialog';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useExactMoney } from '@/hooks/use-exact-money';
import { batchReference, failureMessage, problemCodeOf } from '@/lib/agency-finance';
import { useConfirmPaid, useDownloadBatchFile } from '@/queries/wireTransfer';
import type { CreateBatchResponse, WireBatchStatus } from '@/types';

/** A wire file made in this visit: what the server answered when it made it, and the debit account as the page may show it (masked). */
export interface CreatedBatch extends CreateBatchResponse {
  debitMasked: string;
}

interface WireBatchCardProps {
  batch: CreatedBatch;
  /** The batch is paid (the administrator marked it, or the server said it already was): the page stops asking before it is left. */
  onPaid: (batchId: string) => void;
}

const STATUS_CLASS: Record<WireBatchStatus, string> = {
  Generated: 'bg-blue-100 text-blue-800',
  Downloaded: 'bg-yellow-100 text-yellow-800',
  Paid: 'bg-green-100 text-green-800',
};

/**
 * A wire file the agency made (ADR-017), the three steps of it and what each one means. The amount, the currency and the number of transfers are the server's, shown
 * as they came (nothing is added up or rounded here). The server has no read of a batch, so the step shown is the last one the server confirmed with an answer of its own:
 * the file is «downloaded» when the server handed it out, and «paid» only after the administrator confirmed it and the server accepted. «Paid» is the administrator's
 * word: CasaZen does not know whether the bank executed the transfers, and the card says so. Marking it cannot be undone, so it asks to be confirmed with the file, the
 * amount and the currency. The card owns its requests: while any of them is on its way every button of the card waits, and an answer of the server that contradicts the
 * step shown (already paid, never downloaded) corrects the step instead of being hidden.
 */
export function WireBatchCard({ batch, onPaid }: WireBatchCardProps) {
  const { t } = useTranslation();
  const money = useExactMoney();
  const download = useDownloadBatchFile();
  const confirmPaid = useConfirmPaid();
  const [status, setStatus] = useState<WireBatchStatus>('Generated');
  const [failure, setFailure] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  // A request is on its way: the state of the mutation says it a moment later than the click, so a second one in between is stopped here.
  const sending = useRef(false);

  const busy = download.isPending || confirmPaid.isPending;
  const reference = batchReference(batch.batchId);
  const amount = money(batch.totalAmount, batch.currency);

  const onDownload = async () => {
    if (busy || sending.current) return;
    sending.current = true;
    setFailure(null);
    try {
      await download.mutateAsync({ batchId: batch.batchId, fallbackName: `wire-batch-${batch.batchId}-${batch.currency}.xml` });
      // The server marks the batch as downloaded the first time it hands the file out.
      setStatus((current) => (current === 'Generated' ? 'Downloaded' : current));
    } catch (error) {
      setFailure(failureMessage(error, t, t('wire.batch.downloadError'), t('wire.batch.notFound')));
    } finally {
      sending.current = false;
      download.reset();
    }
  };

  /** Marked as paid by the administrator's word, after the confirmation. The server's answer decides, and what it says against the step shown corrects the step. */
  const onMarkPaid = async () => {
    if (busy || sending.current || status !== 'Downloaded') return;
    sending.current = true;
    setFailure(null);
    try {
      await confirmPaid.mutateAsync(batch.batchId);
      setStatus('Paid');
      onPaid(batch.batchId);
    } catch (error) {
      const code = problemCodeOf(error);
      if (code === 'batch_already_paid') {
        setStatus('Paid');
        onPaid(batch.batchId);
      } else if (code === 'batch_not_downloaded') setStatus('Generated');
      setFailure(failureMessage(error, t, t('wire.batch.confirmPaidError'), t('wire.batch.notFound')));
    } finally {
      sending.current = false;
      confirmPaid.reset();
    }
  };

  const dismissConfirmation = (open: boolean) => {
    // The request is on its way: the dialog stays until the server has answered, so nobody confirms the same payment twice.
    if (!open && !busy) setConfirming(false);
  };

  return (
    <Card data-testid={`wire-batch-${batch.batchId}`}>
      <CardHeader>
        <CardTitle>{t('wire.batch.details')}</CardTitle>
        <CardDescription>{t('wire.batch.detailsDescription')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <dl className="grid grid-cols-2 gap-4">
          <div>
            <dt className="text-sm text-muted-foreground">{t('wire.batch.id')}</dt>
            <dd className="font-mono text-sm" data-testid="wire-batch-reference">{reference}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">{t('wire.batch.currency')}</dt>
            <dd className="font-medium" data-testid="wire-batch-currency">{batch.currency}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">{t('wire.batch.totalAmount')}</dt>
            <dd className="font-medium" data-testid="wire-batch-amount">{amount}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">{t('wire.batch.transferCount')}</dt>
            <dd className="font-medium" data-testid="wire-batch-count">{batch.transferCount}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">{t('wire.batch.debitAccount')}</dt>
            <dd className="font-mono text-sm" data-testid="wire-batch-debit">{batch.debitMasked}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">{t('wire.batch.status')}</dt>
            <dd className="mt-1">
              <span data-testid="wire-batch-status" data-status={status} className={`px-2 py-1 text-xs font-medium rounded-full ${STATUS_CLASS[status]}`}>
                {t(`wire.status.${status.toLowerCase()}`)}
              </span>
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
            {t('wire.batch.paidComplete')}
          </Alert>
        ) : (
          <p className="text-sm text-muted-foreground" data-testid="wire-batch-next">
            {status === 'Generated' ? t('wire.batch.nextDownload') : t('wire.batch.nextUpload')}
          </p>
        )}

        <div className="flex flex-wrap gap-3">
          <Button onClick={() => void onDownload()} disabled={busy} variant={status === 'Generated' ? 'default' : 'outline'} data-testid="wire-batch-download">
            <Download className="h-4 w-4 mr-2" />
            {t('wire.batch.download')}
          </Button>
          {status !== 'Paid' && (
            <Button onClick={() => setConfirming(true)} disabled={busy || status !== 'Downloaded'} data-testid="wire-batch-mark-paid">
              <CheckCircle className="h-4 w-4 mr-2" />
              {t('wire.batch.markPaid')}
            </Button>
          )}
        </div>

        {status !== 'Paid' && (
          <p className="text-xs text-muted-foreground" data-testid="wire-batch-leave-hint">
            {t('wire.batch.leaveHint')}
          </p>
        )}
      </CardContent>

      <ConfirmationDialog
        open={confirming}
        onOpenChange={dismissConfirmation}
        title={t('wire.batch.confirmPaidTitle')}
        description={t('wire.batch.confirmPaidDescription', { reference })}
        consequences={[t('wire.batch.consequenceWord'), t('wire.batch.consequenceFinal')]}
        confirmLabel={t('wire.batch.markPaid')}
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
            <dd className="font-medium" data-testid="wire-confirm-currency">{batch.currency}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t('wire.batch.totalAmount')}</dt>
            <dd className="font-semibold" data-testid="wire-confirm-amount">{amount}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t('wire.batch.transferCount')}</dt>
            <dd className="font-medium">{batch.transferCount}</dd>
          </div>
        </dl>
      </ConfirmationDialog>
    </Card>
  );
}
