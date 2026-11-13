import { useTranslation } from 'react-i18next';
import { reportCollectionsApi, collectionsFileName } from '@/api/report-collections.api';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { Alert } from '@/components/ui/alert';
import { MoneyReportFilters } from '@/features/reports/money-reports/money-report-filters';
import { reportView } from '@/features/reports/money-reports/money-model';
import { ReportExportButtons } from '@/features/reports/money-reports/report-export-buttons';
import { ReportNotReady } from '@/features/reports/money-reports/report-not-ready';
import { useMoneyReportFilters } from '@/features/reports/money-reports/use-money-report-filters';
import { useWorkspace } from '@/hooks/use-workspace';
import { useBalancesToCollect, useCollectionsReport } from '@/queries/use-report-collections';
import { BalancesTable } from './balances-table';
import { CollectionsBreakdown } from './collections-breakdown';
import { CreditsSection } from './credits-section';

/**
 * The page of what came in, what is still to collect and what reached the account (NF-97, REP-02), reached from the list of reports.
 * Every figure is read from `GET /api/reports/collections` and `GET /api/reports/balances-to-collect`; the page works out nothing, adds
 * nothing up and rounds nothing, and two currencies are never put together. It is for who may read payments (`payment.read`: the route
 * asks for it, and without it the page asks the server for nothing); the server limits every figure to the properties the person
 * reaches. The days are the presets of the reports and the days to type, both required, checked before the call.
 */
export function CollectionsReportPage() {
  const { t } = useTranslation();
  const { hasPermission } = useWorkspace();
  const canRead = hasPermission('short-rent', 'payment.read');

  return (
    <AppShell>
      <div className="space-y-6" data-testid="collections-report-page">
        {canRead ? (
          <CollectionsReportContent />
        ) : (
          // The route keeps who may not read payments out; a page reached some other way asks the server for nothing and says so.
          <>
            <PageHeader title={t('reports.collections.title')} description={t('reports.collections.description')} crumbs="auto" />
            <Alert variant="info" data-testid="collections-no-access">
              {t('reports.money.noAccess')}
            </Alert>
          </>
        )}
      </div>
    </AppShell>
  );
}

function CollectionsReportContent() {
  const { t } = useTranslation();
  const filters = useMoneyReportFilters('thisMonth');
  const { days, propertyId, problem } = filters;
  // The server is not asked for days it would refuse: the page says why, and shows nothing of an earlier choice.
  const asked = problem === null;

  const collectionsQuery = useCollectionsReport(days, propertyId, asked);
  const balancesQuery = useBalancesToCollect(propertyId, true);
  const collections = reportView(collectionsQuery);
  const balances = reportView(balancesQuery);
  // The same refusal said twice (both reads are not for the person, or both name a property that is not theirs) is said once.
  const saidAbove = asked && collections.kind === balances.kind && (balances.kind === 'forbidden' || balances.kind === 'notFound');

  return (
    <>
      <PageHeader
        title={t('reports.collections.title')}
        description={t('reports.collections.description')}
        crumbs="auto"
        action={
          <ReportExportButtons
            requestKey={`${days.from}|${days.to}|${propertyId}`}
            disabled={!asked}
            fetchFile={(format) => (format === 'xlsx' ? reportCollectionsApi.downloadXlsx(days, propertyId) : reportCollectionsApi.downloadCsv(days, propertyId))}
            fileName={(format) => collectionsFileName(days, format)}
            testId="collections-export"
          />
        }
      />

      <MoneyReportFilters filters={filters} testId="collections" />

      {asked ? (
        collections.kind === 'ready' ? (
          <CollectionsBreakdown report={collections.data} />
        ) : (
          <ReportNotReady
            view={collections}
            errorTitle={t('reports.collections.error')}
            onRetry={() => void collectionsQuery.refetch()}
            onShowAllProperties={propertyId ? () => filters.chooseProperty('') : undefined}
            testId="collections"
          />
        )
      ) : null}

      {balances.kind === 'ready' ? (
        <BalancesTable report={balances.data} />
      ) : saidAbove ? null : (
        <ReportNotReady
          view={balances}
          errorTitle={t('reports.collections.balances.error')}
          onRetry={() => void balancesQuery.refetch()}
          onShowAllProperties={propertyId ? () => filters.chooseProperty('') : undefined}
          testId="collections-balances-state"
        />
      )}

      {asked && collections.kind === 'ready' ? <CreditsSection credits={collections.data.credits} /> : null}
    </>
  );
}
