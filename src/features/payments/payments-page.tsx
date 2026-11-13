import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { StatStrip, StatTile } from '@/components/shared/calm';
import { ListView } from '@/components/shared/list-view/list-view';
import { Segmented } from '@/components/ui/segmented';
import { useListViewsScope } from '@/hooks/use-list-views-scope';
import { useWorkspace } from '@/hooks/use-workspace';
import { usePayments } from '@/queries/use-payments';
import { formatStayDate, startOfMonth, todayInRome } from '@/lib/stay-dates';
import { formatCurrency } from '@/lib/utils';
import type { PaymentListItem } from '@/types';
import { PaymentLedgerPeriod } from './components/payment-ledger-period';
import { usePaymentsList } from './payments-list';
import { PAYMENTS_PATH, monthRange, summarizeMonth, type PaymentsMonth } from './lib/payment-list';

const NO_PAYMENTS: readonly PaymentListItem[] = [];

/** The two ways to see the payments: one by one (the list), or as the ledger of a period (FIS-05). */
type PaymentsView = 'payments' | 'ledger';

/**
 * The numbers of the month, quiet and in one row: what came in (net of what went back), what is still to come and what went
 * back. Each one leads to the payments it is made of.
 */
function PaymentsSummary({ month, today }: { month: PaymentsMonth; today: string }) {
  const { t, i18n } = useTranslation();
  const monthName = formatStayDate(startOfMonth(today), i18n.language, { month: 'long' });
  const euros = (cents: number) => formatCurrency(cents / 100);
  const range = monthRange(today);

  return (
    <StatStrip label={t('payment.list.summary.label')} data-testid="payments-summary">
      <StatTile
        label={t('payment.list.summary.collected', { month: monthName })}
        value={euros(month.collectedCents)}
        href={`${PAYMENTS_PATH}?chip=collected&f_date=${range}`}
        data-testid="payments-summary-collected"
      />
      <StatTile
        label={t('payment.list.summary.waiting')}
        value={euros(month.waitingCents)}
        href={`${PAYMENTS_PATH}?chip=toCollect`}
        data-testid="payments-summary-waiting"
      />
      <StatTile
        label={t('payment.list.summary.refunded', { month: monthName })}
        value={euros(month.refundedCents)}
        href={`${PAYMENTS_PATH}?chip=refunded&f_date=${range}`}
        data-testid="payments-summary-refunded"
      />
    </StatStrip>
  );
}

/**
 * The payments of the host (SR-04c): the three numbers of the month and the unified list in `client` mode. The API gives every
 * payment at once, so the search, the quick filters (in arrivo, which the page opens on, all, to collect, collected, refunded,
 * cancelled), the filters (property, method, dates), the order and the views all work on the rows in the page, and all of it is in
 * the address (`?chip=toCollect&f_method=BankTransfer`; the page opens on «In arrivo» when there is no `chip`).
 * The page is for who may read the payments (`payment.read`); the others find the reserved page of the shell.
 *
 * A switch above them, «Per pagamento» (the list, as it was) and «Per prenotazione e periodo» (E06/F04/US01/T04, FIS-05): the payment ledger of a period, a table with
 * one line for each thing collected, card, manual or channel, with its commission, its net and its state, a page at a time. The page opens on the list; the ledger asks
 * nothing until it is chosen, and the choice is in the screen and not in the address.
 */
export function PaymentsPage() {
  const { t } = useTranslation();
  const { hasPermission } = useWorkspace();
  const viewsScope = useListViewsScope();
  const [view, setView] = useState<PaymentsView>('payments');
  const list = usePaymentsList({
    canCreateBooking: hasPermission('short-rent', 'booking.write'),
    canRecordPayment: hasPermission('short-rent', 'payment.write'),
  });

  const payments = usePayments();
  const rows = Array.isArray(payments.data) ? payments.data : NO_PAYMENTS;
  const today = todayInRome();
  const month = useMemo(() => summarizeMonth(rows, today), [rows, today]);

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader title={t('payment.list.title')} description={t('payment.list.description')} />

        <Segmented<PaymentsView>
          label={t('paymentLedger.switch.label')}
          value={view}
          onValueChange={setView}
          options={[
            { value: 'payments', label: t('paymentLedger.switch.byPayment'), testId: 'payments-view-payments' },
            { value: 'ledger', label: t('paymentLedger.switch.byPeriod'), testId: 'payments-view-ledger' },
          ]}
          testId="payments-view-switch"
        />

        {view === 'ledger' ? (
          <PaymentLedgerPeriod />
        ) : (
          <>
            {rows.length > 0 && !payments.isError ? <PaymentsSummary month={month} today={today} /> : null}

            <ListView
              list={list}
              rows={rows}
              isLoading={payments.isLoading}
              isError={payments.isError && !payments.isLoading}
              error={payments.error}
              errorTitle={t('payment.list.loadError')}
              onRetry={() => void payments.refetch()}
              viewsScope={viewsScope}
              testId="payments-list"
            />
          </>
        )}
      </div>
    </AppShell>
  );
}
