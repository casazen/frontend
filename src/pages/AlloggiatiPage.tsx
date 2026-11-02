import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAlloggiatiReports, useAlloggiatiErrors } from '@/queries/use-alloggiati';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { LoadingScreen } from '@/components/shared/loading-screen';
import { Alert } from '@/components/ui/alert';
import { Select } from '@/components/ui/select';
import { ReportStatus } from '@/components/alloggiati/ReportStatus';
import { AlertCircle, ChevronDown, ChevronRight } from 'lucide-react';
import type { AlloggiatiReportFilters, AlloggiatiWebStatus } from '@/types/alloggiati.types';
import { format, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';

export function AlloggiatiPage() {
  const { t } = useTranslation();
  const [filters, setFilters] = useState<AlloggiatiReportFilters>({});
  const [expandedReportId, setExpandedReportId] = useState<string | null>(null);

  const { data: reports, isLoading, error } = useAlloggiatiReports(filters);
  const { data: errors } = useAlloggiatiErrors(expandedReportId || '');

  // Group reports by status for dashboard view
  const reportsByStatus = useMemo(() => {
    if (!reports) return {};

    const grouped: Record<string, typeof reports> = {};
    reports.forEach((report) => {
      if (!grouped[report.status]) {
        grouped[report.status] = [];
      }
      grouped[report.status].push(report);
    });

    return grouped;
  }, [reports]);

  const handleFilterChange = (key: keyof AlloggiatiReportFilters, value: string) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value || undefined,
    }));
  };

  const toggleReportExpansion = (reportId: string) => {
    setExpandedReportId(expandedReportId === reportId ? null : reportId);
  };

  if (isLoading) {
    return <LoadingScreen message={t('alloggiati.loading')} />;
  }

  if (error) {
    return (
      <AppShell>
        <div className="space-y-6 md:space-y-8">
          <PageHeader title={t('alloggiati.title')} description={t('alloggiati.description')} crumbs="auto" />
          <Alert variant="danger" title={t('shared.error')} icon={AlertCircle}>
            {t('alloggiati.loadError')}
          </Alert>
        </div>
      </AppShell>
    );
  }

  const statusOptions: AlloggiatiWebStatus[] = [
    'DaInviare',
    'DaInviareManualmente',
    'SentReceiptPending',
    'InviatoManualmente',
    'Inviato',
    'Errore',
    'Rifiutato',
  ];

  return (
    <AppShell>
      <div className="space-y-6 md:space-y-8" data-testid="alloggiati-dashboard">
        <PageHeader title={t('alloggiati.title')} description={t('alloggiati.description')} crumbs="auto" />

        {/* Dashboard summary cards */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Object.entries(reportsByStatus).map(([status, statusReports]) => (
          <div
            key={status}
            className="rounded-lg border bg-card p-4 shadow-sm"
          >
            <div className="mb-2">
              <ReportStatus status={status as AlloggiatiWebStatus} />
            </div>
            <div className="text-2xl font-bold">{statusReports.length}</div>
            <div className="text-sm text-muted-foreground">
              {statusReports.length === 1 ? t('alloggiati.report') : t('alloggiati.reports')}
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap gap-4">
        <div className="w-full sm:w-64">
          <label htmlFor="status-filter" className="text-sm font-medium mb-2 block">
            {t('alloggiati.filter.status')}
          </label>
          <Select
            id="status-filter"
            value={filters.status || ''}
            onChange={(e) => handleFilterChange('status', e.target.value)}
          >
            <option value="">{t('alloggiati.filter.allStatuses')}</option>
            {statusOptions.map((status) => (
              <option key={status} value={status}>
                {t(`alloggiati.status.${status.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '')}`)}
              </option>
            ))}
          </Select>
        </div>

        <div className="w-full sm:w-64">
          <label htmlFor="date-from" className="text-sm font-medium mb-2 block">
            {t('alloggiati.filter.fromDate')}
          </label>
          <input
            type="date"
            id="date-from"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={filters.fromDate || ''}
            onChange={(e) => handleFilterChange('fromDate', e.target.value)}
          />
        </div>

        <div className="w-full sm:w-64">
          <label htmlFor="date-to" className="text-sm font-medium mb-2 block">
            {t('alloggiati.filter.toDate')}
          </label>
          <input
            type="date"
            id="date-to"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={filters.toDate || ''}
            onChange={(e) => handleFilterChange('toDate', e.target.value)}
          />
        </div>
      </div>

      {/* Reports list */}
      <div className="space-y-2">
        {!reports || reports.length === 0 ? (
          <div className="rounded-lg border bg-card p-8 text-center">
            <p className="text-muted-foreground">{t('alloggiati.noReports')}</p>
          </div>
        ) : (
          reports.map((report) => (
            <div
              key={report.reportId}
              className="rounded-lg border bg-card shadow-sm"
            >
              <button
                type="button"
                onClick={() => toggleReportExpansion(report.reportId)}
                className="w-full p-4 text-left hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      {expandedReportId === report.reportId ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                      <h3 className="font-semibold">{report.guestName}</h3>
                    </div>
                    <div className="text-sm text-muted-foreground mb-2">
                      {report.propertyName} · {format(parseISO(report.checkInDate), 'dd MMM yyyy', { locale: it })}
                    </div>
                    <ReportStatus
                      status={report.status}
                      deadlineAt={report.deadlineAt}
                      hoursUntilDeadline={report.hoursUntilDeadline}
                      isOverdue={report.isOverdue}
                    />
                  </div>
                  {report.confirmationNumber && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">{t('alloggiati.confirmationNumber')}:</span>{' '}
                      <span className="font-mono">{report.confirmationNumber}</span>
                    </div>
                  )}
                </div>
              </button>

              {/* Expanded error details */}
              {expandedReportId === report.reportId && report.hasErrors && errors && (
                <div className="border-t bg-muted/30 p-4">
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-red-600" />
                    {t('alloggiati.error.row_invalid')}
                  </h4>
                  <div className="space-y-2">
                    {errors.map((error, idx) => (
                      <div
                        key={idx}
                        className="rounded-md border border-red-200 bg-red-50 p-3 text-sm"
                      >
                        <div className="font-medium text-red-900">
                          {t('alloggiati.error.row')} {error.rowNumber}: {error.guestName}
                        </div>
                        <div className="mt-1 text-red-700">
                          <span className="font-mono text-xs">{error.tipoErrore}</span> - {error.errorMessage}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {expandedReportId === report.reportId && !report.hasErrors && (
                <div className="border-t bg-muted/30 p-4 text-sm text-muted-foreground">
                  {t('alloggiati.noErrors')}
                </div>
              )}
            </div>
          ))
        )}
      </div>
      </div>
    </AppShell>
  );
}
