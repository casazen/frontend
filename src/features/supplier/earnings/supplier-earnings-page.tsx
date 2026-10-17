import { Download } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/layout/page-header';
import { StatStrip, StatTile } from '@/components/shared/calm';
import { ListView } from '@/components/shared/list-view/list-view';
import { useListState } from '@/components/shared/list-view/use-list-state';
import { Button } from '@/components/ui/button';
import { SkeletonLine } from '@/components/ui/skeleton';
import { useListViewsScope } from '@/hooks/use-list-views-scope';
import { formatRomeDateTime } from '@/lib/stay-dates';
import { useDownloadSupplierEarnings, useSupplierEarnings } from '@/queries/use-supplier-earnings';
import type { SupplierEarningsParams, SupplierEarningsTab } from '@/types/supplier-earnings';
import { formatMoney } from '../services/lib/service-money';
import { EARNINGS_TABS, freePeriodEnd, isEarningsPeriod, periodRange } from './earnings-model';
import { useSupplierEarningsList } from './supplier-earnings-list';

const PAGE_SIZE = 20;
const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The earnings of the supplier (SP-16b): what is owed to it and what it has been paid, job by job, with gross, commission and net, and a
 * file for the accountant. Three quiet numbers (to collect, paid this month, the commission of CasaZen this month), the list of the jobs
 * with the tabs of the server and a period, and the commission that applies now. Every figure is the server's: nothing is computed here, and
 * no date of payout is promised. It only reads (and downloads): it asks nobody for a payment. The page is behind `SupplierOnlinePayments`.
 * A load that fails says it and offers "Riprova". With `?clientId=` (from the page of the customers) only the jobs of that customer.
 */
export function SupplierEarningsPage() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const list = useSupplierEarningsList();
  const viewsScope = useListViewsScope();
  const { state } = useListState(list);
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedClient = searchParams.get('clientId');
  const clientId = requestedClient && GUID.test(requestedClient) ? requestedClient : undefined;

  const period = isEarningsPeriod(state.filters.period) ? state.filters.period : undefined;
  const params: SupplierEarningsParams = {
    tab: (EARNINGS_TABS as readonly string[]).includes(state.chip) ? (state.chip as SupplierEarningsTab) : 'tutti',
    ...(period ? periodRange(period) : {}),
    ...(clientId ? { clientId } : {}),
    page: state.page,
    pageSize: PAGE_SIZE,
  };
  const earnings = useSupplierEarnings(params);
  const download = useDownloadSupplierEarnings();
  const summary = earnings.data?.summary;
  const freeEnds = freePeriodEnd(summary?.commission.freeUntil);

  return (
    <div className="min-w-0 space-y-6" data-testid="supplier-earnings-page">
      <PageHeader
        title={t('supplier.earnings.title')}
        description={t('supplier.earnings.description')}
        crumbs="auto"
        primary={{
          label: t('supplier.earnings.export'),
          icon: Download,
          onClick: () => download.mutate(params),
          disabled: download.isPending,
          testId: 'supplier-earnings-export',
        }}
      />

      {summary ? (
        <>
          <StatStrip label={t('supplier.earnings.numbers.label')}>
            <StatTile
              data-testid="supplier-earnings-to-collect"
              label={t('supplier.earnings.numbers.toCollect')}
              value={formatMoney(summary.toCollectNetCents, locale)}
              delta={t('supplier.earnings.numbers.toCollectJobs', { count: summary.toCollectJobs })}
            />
            <StatTile data-testid="supplier-earnings-paid" label={t('supplier.earnings.numbers.paid')} value={formatMoney(summary.paidThisMonthNetCents, locale)} />
            <StatTile
              data-testid="supplier-earnings-commission"
              label={t('supplier.earnings.numbers.commission')}
              value={formatMoney(summary.commissionThisMonthCents, locale)}
            />
          </StatStrip>
          <p className="text-sm text-foreground/70" data-testid="supplier-earnings-rate">
            {freeEnds
              ? t('supplier.earnings.rate.free', { day: formatRomeDateTime(freeEnds, locale, { day: 'numeric', month: 'long', year: 'numeric' }) })
              : summary.commission.percent === 0
                ? t('supplier.earnings.rate.none')
                : t('supplier.earnings.rate.normal', { percent: new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(summary.commission.percent) })}
          </p>
        </>
      ) : earnings.isLoading ? (
        <SkeletonLine lines={3} label={t('supplier.earnings.loading')} />
      ) : null}

      {clientId ? (
        <div className="flex flex-wrap items-center gap-3 text-sm" data-testid="supplier-earnings-client-filter">
          <span>{t('supplier.earnings.clientFilter.note')}</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              setSearchParams(
                (previous) => {
                  previous.delete('clientId');
                  return previous;
                },
                { replace: true },
              )
            }
          >
            {t('supplier.earnings.clientFilter.clear')}
          </Button>
        </div>
      ) : null}

      <ListView
        list={list}
        mode="server"
        rows={earnings.data?.items ?? []}
        totalCount={earnings.data?.total}
        pageSize={PAGE_SIZE}
        isLoading={earnings.isLoading}
        isRefreshing={earnings.isPlaceholderData}
        isError={earnings.isError && !earnings.data}
        error={earnings.error}
        errorTitle={t('supplier.earnings.loadError')}
        onRetry={() => void earnings.refetch()}
        chipCounts={{ 'in-ritardo': summary?.lateCount }}
        viewsScope={viewsScope}
        testId="supplier-earnings-list"
      />
    </div>
  );
}
