import { useState } from 'react';
import { Wallet } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ListPagination } from '@/components/shared/list-view/list-pagination';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { useFeatureFlags } from '@/hooks/use-feature-flags';
import { useWorkspace } from '@/hooks/use-workspace';
import { getHttpStatus } from '@/lib/api-errors';
import { todayInRome } from '@/lib/stay-dates';
import { usePeriodLedger } from '@/queries/use-payment-ledger';
import type { PaymentLedgerLine } from '@/types';
import {
  defaultPeriod,
  documentLinkOf,
  LEDGER_DAY_LIMITS,
  LEDGER_PAGE_SIZE,
  ledgerReadOf,
  periodProblemOf,
  type LedgerPeriod,
} from '../lib/payment-ledger';
import { PaymentLedgerTable } from './payment-ledger-table';

const NO_LINES: readonly PaymentLedgerLine[] = [];

/**
 * «Per prenotazione e periodo» on the payments page (FIS-05, NF-85, E06/F04/US01/T04): the payment ledger of a period, the same table as the booking has with the
 * booking of each line beside it, a page at a time (the server pages it and counts the lines). It opens on the month that is on; both days are asked, because the server
 * would read the whole history for a day left out and refuses a first day after the last, so it is asked for neither: the screen says why and shows nothing of an
 * earlier choice. The days are in the screen and nowhere else: not in the address, not in the browser's storage.
 *
 * It is for who may read payments (`payment.read`): without it nothing is asked. The server narrows the lines to the properties the caller reaches. The table adds
 * no total of money (the server gives none, and the amounts of a period are in more than one currency); a read that failed is a failed read, with a retry, and is never
 * an empty period.
 */
export function PaymentLedgerPeriod() {
  const { t } = useTranslation();
  const { hasPermission } = useWorkspace();
  const { flags } = useFeatureFlags();
  const canRead = hasPermission('short-rent', 'payment.read');
  const [period, setPeriod] = useState<LedgerPeriod>(() => defaultPeriod(todayInRome()));
  const [page, setPage] = useState(1);
  const problem = periodProblemOf(period);
  const enabled = canRead && problem === null;
  const ledger = usePeriodLedger({ from: period.from, to: period.to }, page, LEDGER_PAGE_SIZE, { enabled });

  // Who may not read payments gets nothing: not a table, not an empty period, not an error.
  if (!canRead) return null;

  // The days of an earlier choice are not shown for one the server was not asked about: the read is `idle` and the table is not drawn.
  const read = ledgerReadOf({ enabled, isError: ledger.isError, status: getHttpStatus(ledger.error), hasData: ledger.data !== undefined });
  const data = read === 'ok' ? ledger.data : undefined;

  // A page past the end (the lines of the period went down while the page was open) goes to the last one that has any.
  if (data && page > 1 && data.items.length === 0 && data.totalCount > 0 && !ledger.isPlaceholderData) {
    setPage(Math.ceil(data.totalCount / LEDGER_PAGE_SIZE));
  }

  const choose = (part: keyof LedgerPeriod, value: string) => {
    setPeriod((current) => ({ ...current, [part]: value }));
    setPage(1);
  };

  return (
    <div className="space-y-4" data-testid="payment-ledger-period">
      <div role="group" aria-label={t('paymentLedger.period.label')} className="flex flex-wrap items-end gap-3">
        <Field label={t('listView.filters.from')} className="w-full sm:w-44">
          <Input
            type="date"
            value={period.from}
            min={LEDGER_DAY_LIMITS.min}
            max={LEDGER_DAY_LIMITS.max}
            onChange={(event) => choose('from', event.target.value)}
            data-testid="payment-ledger-from"
          />
        </Field>
        <Field label={t('listView.filters.to')} className="w-full sm:w-44">
          <Input
            type="date"
            value={period.to}
            min={LEDGER_DAY_LIMITS.min}
            max={LEDGER_DAY_LIMITS.max}
            onChange={(event) => choose('to', event.target.value)}
            data-testid="payment-ledger-to"
          />
        </Field>
      </div>

      {problem === 'order' ? (
        <p role="alert" className="text-sm text-destructive" data-testid="payment-ledger-period-problem" data-problem={problem}>
          {t('listView.filters.dateOrder')}
        </p>
      ) : problem === 'incomplete' ? (
        <p className="text-sm text-foreground/70" data-testid="payment-ledger-period-problem" data-problem={problem}>
          {t('paymentLedger.period.incomplete')}
        </p>
      ) : (
        <PaymentLedgerTable
          lines={data?.items ?? NO_LINES}
          label={t('paymentLedger.period.tableLabel')}
          showBooking
          documentHref={documentLinkOf(hasPermission, flags)}
          // Whatever the failure, a period that could not be read is never drawn as an empty one; a refusal is moved to its own page by the client.
          isLoading={read === 'loading'}
          isError={read === 'failed' || read === 'notFound' || read === 'forbidden'}
          error={ledger.error}
          errorTitle={t('paymentLedger.period.loadError')}
          onRetry={() => void ledger.refetch()}
          isRefreshing={ledger.isPlaceholderData || (read === 'ok' && ledger.isFetching)}
          empty={{ icon: Wallet, title: t('paymentLedger.period.emptyTitle'), description: t('paymentLedger.period.emptyDescription') }}
          footer={
            data && data.totalCount > 0 ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-foreground/70" data-testid="payment-ledger-count">
                  {t('paymentLedger.period.count', { count: data.totalCount })}
                </p>
                <ListPagination page={page} pageSize={LEDGER_PAGE_SIZE} totalCount={data.totalCount} onPageChange={setPage} />
              </div>
            ) : null
          }
          testId="payment-ledger-period-table"
        />
      )}
    </div>
  );
}
