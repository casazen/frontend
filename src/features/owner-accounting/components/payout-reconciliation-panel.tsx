import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { toCents, type ReconciliationPreview } from '../owner-accounting-model';
import { useOwnerFormat } from '../use-owner-format';
import type { OwnerPayout } from '@/types';

interface PayoutReconciliationPanelProps {
  currency: string;
  /** What the page can see of the reconciliation the close will make. */
  preview: ReconciliationPreview;
  /** Every payout made on the versions of the month, the reversed ones too (they are shown, never counted). */
  payouts: readonly OwnerPayout[];
  /** The figures the server answered to a refused close: they are the ones that count, and replace the preview. */
  serverFigures?: { due: number; paid: number; difference: number } | null;
  loading?: boolean;
}

/**
 * Payout and bank reconciliation (AC-NF110-3): what the approved statement says is owed, what the payouts of the month settle, and the
 * difference. A month that does not reconcile, or whose balance is negative, is closed only with a reason and by who may waive it: the panel
 * says so before the person asks to close. The close reads everything again on the server; its figures replace these.
 */
export function PayoutReconciliationPanel({ currency, preview, payouts, serverFigures, loading = false }: PayoutReconciliationPanelProps) {
  const { t } = useTranslation();
  const { money, date } = useOwnerFormat();
  const due = serverFigures?.due ?? preview.due;
  const paid = serverFigures?.paid ?? preview.paid;
  const difference = serverFigures?.difference ?? preview.difference;
  const reconciled = toCents(difference) === 0 && toCents(due) >= 0;

  return (
    <section aria-labelledby="reconciliation-title" className="min-w-0 space-y-3" data-testid="payout-reconciliation">
      <h3 id="reconciliation-title" className="text-base font-semibold">
        {t('ownerAccounting.reconciliation.title')}
      </h3>

      {loading ? (
        <p role="status" className="text-sm text-foreground/70">
          {t('ownerAccounting.reconciliation.loading')}
        </p>
      ) : (
        <>
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <dt className="text-sm text-foreground/70">{t('ownerAccounting.reconciliation.due')}</dt>
              <dd className="text-lg font-semibold tabular-nums" data-testid="reconciliation-due">
                {money(due, currency)}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-foreground/70">{t('ownerAccounting.reconciliation.paid')}</dt>
              <dd className="text-lg font-semibold tabular-nums" data-testid="reconciliation-paid">
                {money(paid, currency)}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-foreground/70">{t('ownerAccounting.reconciliation.difference')}</dt>
              <dd className="text-lg font-semibold tabular-nums" data-testid="reconciliation-difference">
                {money(difference, currency)}
              </dd>
            </div>
          </dl>

          <p className="break-words text-sm" role="status" data-testid="reconciliation-verdict" data-reconciled={reconciled}>
            {reconciled ? t('ownerAccounting.reconciliation.reconciled') : toCents(due) < 0 && toCents(difference) === 0 ? t('ownerAccounting.reconciliation.negative') : t('ownerAccounting.reconciliation.notReconciled')}
          </p>

          {!serverFigures && preview.wiresCountInstead ? (
            <p className="break-words text-sm text-foreground/70" data-testid="reconciliation-wires-note">
              {t('ownerAccounting.reconciliation.wires')}
            </p>
          ) : null}

          {payouts.length > 0 ? (
            <ul role="list" className="divide-y divide-border rounded-md border border-border" aria-label={t('ownerAccounting.reconciliation.payouts')}>
              {payouts.map((payout) => (
                <li key={payout.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-3 py-2 text-sm" data-testid="reconciliation-payout">
                  <span className="min-w-0 break-words">
                    {date(payout.paidOn)}
                    {payout.reference ? ` · ${payout.reference}` : ''}
                  </span>
                  <span className="flex flex-wrap items-center gap-2 tabular-nums">
                    {payout.status === 'Reversed' ? <Badge variant="outline">{t('ownerAccounting.reconciliation.reversed')}</Badge> : null}
                    <span>{t('ownerAccounting.reconciliation.gross', { amount: money(payout.grossAmount, payout.currency) })}</span>
                    {payout.withholdingAmount > 0 ? <span>{t('ownerAccounting.reconciliation.withheld', { amount: money(payout.withholdingAmount, payout.currency) })}</span> : null}
                    <span>{t('ownerAccounting.reconciliation.net', { amount: money(payout.netAmount, payout.currency) })}</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="break-words text-sm text-foreground/70">{t('ownerAccounting.reconciliation.noPayouts')}</p>
          )}
        </>
      )}
    </section>
  );
}
