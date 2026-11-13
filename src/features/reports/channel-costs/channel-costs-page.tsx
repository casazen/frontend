import { useTranslation } from 'react-i18next';
import { channelCostsFileName, reportChannelCostsApi } from '@/api/report-channel-costs.api';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { Alert } from '@/components/ui/alert';
import { MoneyReportFilters } from '@/features/reports/money-reports/money-report-filters';
import { reportView } from '@/features/reports/money-reports/money-model';
import { ReportExportButtons } from '@/features/reports/money-reports/report-export-buttons';
import { ReportNotReady } from '@/features/reports/money-reports/report-not-ready';
import { useMoneyReportFilters } from '@/features/reports/money-reports/use-money-report-filters';
import { useWorkspace } from '@/hooks/use-workspace';
import { useChannelCostsReport } from '@/queries/use-report-channel-costs';
import { ChannelCostsTable } from './channel-costs-table';
import { CostSummaryLine } from './cost-summary-line';

/**
 * The page of what each channel costs (NF-98, REP-03), reached from the list of reports: one line first, "how much each channel costs",
 * and the table after it. Every figure is read from `GET /api/reports/channel-costs`; the page works out nothing, adds nothing up and
 * rounds nothing, and a cost nobody reported is "not available", never zero. It is for who may read payments (`payment.read`: the route
 * asks for it, and without it the page asks the server for nothing); the server limits every figure to the properties the person
 * reaches. The days are the presets of the reports and the days to type, both required, checked before the call.
 */
export function ChannelCostsPage() {
  const { t } = useTranslation();
  const { hasPermission } = useWorkspace();
  const canRead = hasPermission('short-rent', 'payment.read');

  return (
    <AppShell>
      <div className="space-y-6" data-testid="channel-costs-page">
        {canRead ? (
          <ChannelCostsContent />
        ) : (
          // The route keeps who may not read payments out; a page reached some other way asks the server for nothing and says so.
          <>
            <PageHeader title={t('reports.channelCosts.title')} description={t('reports.channelCosts.description')} crumbs="auto" />
            <Alert variant="info" data-testid="channel-costs-no-access">
              {t('reports.money.noAccess')}
            </Alert>
          </>
        )}
      </div>
    </AppShell>
  );
}

function ChannelCostsContent() {
  const { t } = useTranslation();
  const filters = useMoneyReportFilters('last3Months');
  const { days, propertyId, problem } = filters;
  // The server is not asked for days it would refuse: the page says why, and shows nothing of an earlier choice.
  const asked = problem === null;

  const query = useChannelCostsReport(days, propertyId, asked);
  const costs = reportView(query);

  return (
    <>
      <PageHeader
        title={t('reports.channelCosts.title')}
        description={t('reports.channelCosts.description')}
        crumbs="auto"
        action={
          <ReportExportButtons
            requestKey={`${days.from}|${days.to}|${propertyId}`}
            disabled={!asked}
            fetchFile={(format) => (format === 'xlsx' ? reportChannelCostsApi.downloadXlsx(days, propertyId) : reportChannelCostsApi.downloadCsv(days, propertyId))}
            fileName={(format) => channelCostsFileName(days, format)}
            testId="channel-costs-export"
          />
        }
      />

      <MoneyReportFilters filters={filters} testId="channel-costs" />

      {asked ? (
        costs.kind === 'ready' ? (
          costs.data.rows.length === 0 ? (
            <p className="text-sm text-foreground/70" data-testid="channel-costs-empty">
              {t('reports.channelCosts.empty')}
            </p>
          ) : (
            <>
              <CostSummaryLine rows={costs.data.rows} />
              <ChannelCostsTable report={costs.data} />
            </>
          )
        ) : (
          <ReportNotReady
            view={costs}
            errorTitle={t('reports.channelCosts.error')}
            onRetry={() => void query.refetch()}
            onShowAllProperties={propertyId ? () => filters.chooseProperty('') : undefined}
            testId="channel-costs"
          />
        )
      ) : null}
    </>
  );
}
