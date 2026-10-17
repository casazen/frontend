import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { StatStrip, StatTile } from '@/components/shared/calm';
import { ListView } from '@/components/shared/list-view/list-view';
import { BookingsSectionTabs } from '@/features/bookings/components/bookings-section-tabs';
import { BOOKINGS_PATH } from '@/features/bookings/lib/booking-list-query';
import { useListViewsScope } from '@/hooks/use-list-views-scope';
import { useWorkspace } from '@/hooks/use-workspace';
import { usePayments } from '@/queries/use-payments';
import { formatStayDate, startOfMonth, todayInRome } from '@/lib/stay-dates';
import { formatCurrency } from '@/lib/utils';
import type { PaymentListItem } from '@/types';
import { usePaymentsList } from './payments-list';
import { PAYMENTS_PATH, monthRange, summarizeMonth, type PaymentsMonth } from './lib/payment-list';

const NO_PAYMENTS: readonly PaymentListItem[] = [];

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
 * payment at once, so the search, the quick filters (to collect, collected, refunded), the filters (property, method, dates), the
 * order and the views all work on the rows in the page, and all of it is in the address (`?chip=toCollect&f_method=BankTransfer`).
 * The page is for who may read the payments (`payment.read`); the others find the reserved page of the shell.
 */
export function PaymentsPage() {
  const { t } = useTranslation();
  const { hasPermission } = useWorkspace();
  const viewsScope = useListViewsScope();
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
        <PageHeader
          title={t('payment.list.title')}
          description={t('payment.list.description')}
          crumbs={[{ label: t('booking.sections.bookings'), to: BOOKINGS_PATH }, { label: t('payment.list.title') }]}
        />

        <BookingsSectionTabs />

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
      </div>
    </AppShell>
  );
}
