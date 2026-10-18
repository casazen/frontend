import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { ListView } from '@/components/shared/list-view/list-view';
import { useListViewsScope } from '@/hooks/use-list-views-scope';
import { REPORTS, isDownloadable, type DownloadableReport, type ReportDefinition } from '@/features/reports/report-catalog';
import { ReportDownloadDialog } from '@/features/reports/report-download-dialog';
import { useReportsList } from '@/features/reports/reports-list';

/**
 * The reports of short rent (SR-10): eight fixed rows on the unified list. Three of them are new and download a CSV from
 * `GET /api/reports/*` (revenue and occupancy by property, bookings by channel); three are the fiscal reports of today, asked
 * with the same endpoints and the same download code as the fiscal reports page; two lead to the page that already has them
 * (Alloggiati Web, the payments statement). "Scarica" opens a dialog with the days and the format.
 *
 * The page is for who may read payments (`payment.read`: the route asks for it, the others find the reserved page of the shell),
 * because the reports hold aggregated money; the backend asks for the same permission on every read, whatever this page does.
 */
export function ReportsPage() {
  const { t } = useTranslation();
  const viewsScope = useListViewsScope();
  const [downloading, setDownloading] = useState<DownloadableReport | null>(null);

  const openDownload = useCallback((report: ReportDefinition) => {
    if (isDownloadable(report)) setDownloading(report);
  }, []);
  const closeDownload = useCallback(() => setDownloading(null), []);
  const list = useReportsList({ onDownload: openDownload });

  return (
    <AppShell>
      <div className="space-y-6" data-testid="reports-page">
        <PageHeader title={t('reports.title')} description={t('reports.description')} />

        <ListView list={list} rows={REPORTS} viewsScope={viewsScope} testId="reports-list" />

        <ReportDownloadDialog report={downloading} onClose={closeDownload} />
      </div>
    </AppShell>
  );
}
