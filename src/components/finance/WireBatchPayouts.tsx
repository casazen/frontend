import { useTranslation } from 'react-i18next';
import { ErrorState } from '@/components/shared/error-state';
import { Alert } from '@/components/ui/alert';
import { SkeletonCard } from '@/components/ui/skeleton';
import { shortId } from '@/features/owner-accounting/owner-accounting-model';
import { useOwnerFormat } from '@/features/owner-accounting/use-owner-format';
import { useWireBatchPayouts } from '@/queries/wireTransfer';
import { StaleReadNotice } from './stale-read-notice';
import { WireAccessLimited } from './wire-access-limited';
import { WireAmount } from './wire-amount';
import { readStateOf } from './wire-model';

interface WireBatchPayoutsProps {
  batchId: string;
  /** The id the button that opens this part points at (`aria-controls`). */
  id: string;
}

/**
 * The payouts a wire file pays, as the server says them now (`GET api/wire-transfers/batch/{id}/payouts`): the owner each one is for, the statement it pays, its amount in its
 * own currency and, for a payout reversed after the file was made, that it was. The file would still pay such a payout, so while the file is not paid the person is told not to
 * upload it. A file made before the payouts has no list and says so: that is an answer, never to be mistaken for a read that failed. A refusal of the server (403) and a failed
 * read are told as such, with a way to read again, and never drawn as an empty list.
 */
export function WireBatchPayouts({ batchId, id }: WireBatchPayoutsProps) {
  const { t } = useTranslation();
  const format = useOwnerFormat();
  const query = useWireBatchPayouts(batchId);
  // A 404 is «not found» whatever the cache holds; a failure with nothing to show is an error with a retry; a failure with the last answer in memory is the stale notice.
  const state = readStateOf(query);
  const stale = query.isError && Boolean(query.data) && state !== 'notFound';

  const body = () => {
    if (state === 'notFound' || state === 'error') {
      const notFound = state === 'notFound';
      return (
        <ErrorState
          testId="wire-batch-payouts-error"
          title={notFound ? t('wire.batch.notFound') : t('wire.batch.payouts.loadError')}
          error={notFound ? undefined : query.error}
          onRetry={() => void query.refetch()}
        />
      );
    }
    // The server refuses the read (403): the access is not there, and nothing of the payouts of the file is offered.
    if (query.data === null) return <WireAccessLimited testId="wire-batch-payouts-refused" />;
    if (state === 'loading' || !query.data) return <SkeletonCard lines={2} label={t('wire.batch.payouts.loading')} />;

    const { batch, payouts } = query.data;
    if (payouts.length === 0) {
      return (
        <p className="text-sm text-muted-foreground" data-testid="wire-batch-payouts-empty">
          {t('wire.batch.payouts.empty')}
        </p>
      );
    }
    // The file of a payout reversed after it was made would still pay it: until the file is paid, it is not to be uploaded.
    const reversedInFile = batch.status !== 'Paid' && payouts.some((payout) => payout.status === 'Reversed');
    return (
      <div className="space-y-3">
        <p className="text-sm font-medium" data-testid="wire-batch-payouts-count">
          {t('wire.batch.payouts.count', { count: payouts.length })}
        </p>
        {reversedInFile && (
          <Alert variant="danger" data-testid="wire-batch-payouts-reversed">
            {t('apiErrors.codes.wireBatchPayoutsReversed')}
          </Alert>
        )}
        <ul role="list" className="divide-y rounded-md border">
          {payouts.map((payout) => {
            const name = payout.ownerName.trim() || t('ownerAccounting.owner.unnamed', { id: shortId(payout.ownerId) });
            return (
              <li
                key={payout.payoutId}
                data-testid={`wire-batch-payout-${payout.payoutId}`}
                data-status={payout.status}
                className="grid gap-1 p-3 sm:grid-cols-[1fr_auto] sm:gap-x-6"
              >
                <span className="min-w-0">
                  <span className="block break-words font-medium" data-testid="wire-batch-payout-owner">
                    {name}
                  </span>
                  <span className="block text-sm text-muted-foreground" data-testid="wire-batch-payout-period">
                    {t('wire.row.period', { period: format.month(payout.periodYear, payout.periodMonth) })}
                  </span>
                </span>
                <span className="min-w-0 sm:text-right">
                  <WireAmount amount={payout.amount} currency={payout.currency} className="block font-semibold" testId="wire-batch-payout-amount" />
                  {payout.status === 'Reversed' && (
                    <span className="block text-sm font-medium text-destructive" data-testid="wire-batch-payout-reversed">
                      {t('wire.batch.payouts.reversed')}
                    </span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    );
  };

  return (
    <div id={id} className="space-y-3 border-t pt-4" data-testid={`wire-batch-payouts-${batchId}`}>
      {stale && <StaleReadNotice onRetry={() => void query.refetch()} />}
      {body()}
    </div>
  );
}
