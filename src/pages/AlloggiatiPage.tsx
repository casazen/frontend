import { useState } from 'react';
import { Archive, ChevronLeft, ChevronRight, Download, Upload } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, type TabItem } from '@/components/ui/tabs';
import { ComplianceCoverageReport } from '@/features/compliance/components/compliance-coverage-report';
import { ProofArchiveTable } from '@/features/compliance/components/proof-archive-table';
import { ProofUploadDialog, type ProofUploadPrefill } from '@/features/compliance/components/proof-upload-dialog';
import {
  ARCHIVE_PARAMS,
  archiveWindow,
  formatPeriod,
  isTaxKind,
  listedMonths,
  listedYears,
  readArchiveAddress,
  type ArchiveTab,
} from '@/features/compliance/lib/archive-model';
import { useFeatureFlags } from '@/hooks/use-feature-flags';
import { useWorkspace } from '@/hooks/use-workspace';
import { getHttpStatus, getProblemMessage } from '@/lib/api-errors';
import { todayInRome } from '@/lib/stay-dates';
import { useComplianceEvidence, useCoverageReport, useDownloadProof, useExportCoverageReport, useExportProofs } from '@/queries/compliance-archive';
import { useProperties } from '@/queries/use-properties';
import { COMPLIANCE_PROOF_KINDS, type ComplianceProofKind, type Property } from '@/types';

/** Proofs in a page of the list. */
const PAGE_SIZE = 25;

/** The formats the coverage report is downloaded in. */
const REPORT_FORMATS = ['pdf', 'csv'] as const;

const NO_PROPERTIES: Property[] = [];

/**
 * `/app/short-rent/alloggiati/reports`: the archive of the proofs (NF-47, NF-52, CHK-08, CHK-12 point 8). «Prove» lists the files CasaZen actually holds
 * (the receipts of the Alloggiati communications, the proofs of ISTAT, the tax receipts), each one downloaded through the API, with the ZIP of the
 * filtered period and the way to upload a proof; «Riepilogo» (behind the traffic light) says what is expected for the period and what is still to
 * prove. The filters (property, kind, month or year, one day) are in the address, and the links of the cockpit open the page with them
 * (`?kind=IstatProof&property=<id>&period=2026-08`): the address wins over anything else. What the caller may read is decided by the server; this page
 * offers a tax proof only to who may read (and, to upload, write) payments, and an upload only to who may submit the Alloggiati.
 */
export function AlloggiatiPage() {
  const { t, i18n } = useTranslation();
  const language = i18n.language;
  const [params, setParams] = useSearchParams();
  const { hasPermission } = useWorkspace();
  const hasSummary = useFeatureFlags().flags.complianceTrafficLight;
  const today = todayInRome();
  const address = readArchiveAddress(params, hasSummary);
  const { from, to } = archiveWindow(address, today);

  // A tax receipt is a record of money: it is read with `payment.read` and uploaded with `payment.write`, an upload of any kind with `alloggiati.submit`.
  const canReadMoney = hasPermission('short-rent', 'payment.read');
  const canWriteMoney = hasPermission('short-rent', 'payment.write');
  const readableKinds = COMPLIANCE_PROOF_KINDS.filter((candidate) => canReadMoney || !isTaxKind(candidate));
  const uploadKinds = hasPermission('short-rent', 'alloggiati.submit')
    ? readableKinds.filter((candidate) => !isTaxKind(candidate) || canWriteMoney)
    : [];
  const kind = readableKinds.find((candidate) => candidate === address.kind);
  const canUpload = (candidate: ComplianceProofKind) => uploadKinds.includes(candidate);

  const properties = useProperties({}, { fresh: true });
  const propertyList = Array.isArray(properties.data) ? properties.data : NO_PROPERTIES;
  // The queries wait for the properties, which the address is checked against: a property that is not one of the caller's is no filter.
  const ready = !properties.isLoading;
  const propertyId = address.propertyId && (properties.isError || propertyList.some((property) => property.id === address.propertyId)) ? address.propertyId : undefined;

  const list = useComplianceEvidence({ propertyId, from, to, kind, page: address.page, pageSize: PAGE_SIZE }, ready);
  const report = useCoverageReport({ from, to, propertyId }, ready && hasSummary && address.tab === 'summary');
  const download = useDownloadProof();
  const exportZip = useExportProofs();
  const exportReport = useExportCoverageReport();
  // Every button of the page waits while any of these is under way: one file at a time.
  const busy = download.isPending || exportZip.isPending || exportReport.isPending;
  const [uploading, setUploading] = useState<ProofUploadPrefill | null>(null);

  const change = (changes: Record<string, string | null>, keepPage = false) => {
    const next = new URLSearchParams(params);
    for (const [name, value] of Object.entries(changes)) {
      if (value) next.set(name, value);
      else next.delete(name);
    }
    if (!keepPage) next.delete(ARCHIVE_PARAMS.page);
    setParams(next, { replace: true, preventScrollReset: true });
  };

  const current = address.day ?? address.period ?? '';
  const periodOptions = [
    { value: '', label: t('complianceArchive.filters.recent') },
    ...listedMonths(today).map((month) => ({ value: month, label: formatPeriod(month, language) })),
    ...listedYears(today).map((year) => ({ value: year, label: t('complianceArchive.filters.wholeYear', { year }) })),
  ];
  // A day or a month the address asks for that the list does not offer is still the one in use.
  if (current && !periodOptions.some((option) => option.value === current)) periodOptions.push({ value: current, label: formatPeriod(current, language) });

  const startUpload = (prefill?: ProofUploadPrefill) =>
    setUploading({
      propertyId,
      kind,
      day: address.day,
      period: address.period && address.period.length === 7 ? address.period : undefined,
      ...prefill,
    });

  const tabs: TabItem<ArchiveTab>[] = [
    { value: 'summary', label: t('complianceArchive.tabs.summary'), testId: 'archive-tab-summary' },
    { value: 'proofs', label: t('complianceArchive.tabs.proofs'), testId: 'archive-tab-proofs' },
  ];

  const filters = (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="archive-filters">
      {propertyList.length > 1 ? (
        <Field label={t('complianceArchive.filters.property')}>
          <Select value={propertyId ?? ''} onChange={(event) => change({ [ARCHIVE_PARAMS.property]: event.target.value || null })} data-testid="archive-filter-property">
            <option value="">{t('complianceArchive.filters.allProperties')}</option>
            {propertyList.map((property) => (
              <option key={property.id} value={property.id}>
                {property.name}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}
      <Field label={t('complianceArchive.filters.kind')}>
        <Select value={kind ?? ''} onChange={(event) => change({ [ARCHIVE_PARAMS.kind]: event.target.value || null })} data-testid="archive-filter-kind">
          <option value="">{t('complianceArchive.filters.allKinds')}</option>
          {readableKinds.map((candidate) => (
            <option key={candidate} value={candidate}>
              {t(`complianceArchive.kind.${candidate}`)}
            </option>
          ))}
        </Select>
      </Field>
      <Field label={t('complianceArchive.filters.period')}>
        <Select
          value={current}
          onChange={(event) => change({ [ARCHIVE_PARAMS.period]: event.target.value || null, [ARCHIVE_PARAMS.day]: null })}
          data-testid="archive-filter-period"
        >
          {periodOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </Field>
    </div>
  );

  const totalPages = list.data ? Math.max(1, Math.ceil(list.data.totalCount / (list.data.pageSize || PAGE_SIZE))) : 1;

  const proofs = (
    <div className="space-y-4" data-testid="archive-proofs">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="min-h-11"
          loading={exportZip.isPending}
          disabled={busy}
          onClick={() => exportZip.mutate({ from, to, propertyId })}
          data-testid="archive-export-zip"
        >
          <Download className="size-4" aria-hidden="true" />
          {t('complianceArchive.proofs.exportZip')}
        </Button>
        <span className="text-sm text-muted-foreground">{t('complianceArchive.proofs.exportPeriod', { period: current ? formatPeriod(current, language) : t('complianceArchive.filters.recent') })}</span>
      </div>
      {exportZip.isError ? (
        <Alert variant="danger" role="alert" data-testid="archive-export-error">
          {getProblemMessage(exportZip.error, t) ?? t('complianceArchive.proofs.exportFailed')}
        </Alert>
      ) : null}

      {!ready || list.isLoading ? (
        <ListSkeleton label={t('complianceArchive.proofs.loading')} />
      ) : list.isError ? (
        // An error is never an empty list, and a 404 is «not found» whatever the cache still holds of an older read.
        <ErrorState
          testId="archive-proofs-error"
          title={t(getHttpStatus(list.error) === 404 ? 'complianceArchive.proofs.notFound' : 'complianceArchive.proofs.loadError')}
          error={getHttpStatus(list.error) === 404 ? undefined : list.error}
          onRetry={() => void list.refetch()}
        />
      ) : list.data && list.data.items.length > 0 ? (
        <div className={list.isPlaceholderData ? 'opacity-60 transition-opacity' : undefined} aria-busy={list.isPlaceholderData}>
          <ProofArchiveTable items={list.data.items} downloading={busy} onDownload={(entry) => download.mutate(entry)} />
          {totalPages > 1 ? (
            <nav className="mt-3 flex items-center justify-between gap-2" aria-label={t('complianceArchive.proofs.pagerLabel')} data-testid="archive-pager">
              <Button type="button" variant="outline" size="sm" className="min-h-11" disabled={address.page <= 1} onClick={() => change({ [ARCHIVE_PARAMS.page]: address.page > 2 ? String(address.page - 1) : null }, true)}>
                <ChevronLeft className="size-4" aria-hidden="true" />
                {t('complianceArchive.proofs.previous')}
              </Button>
              <span className="text-sm text-muted-foreground">{t('complianceArchive.proofs.pageOf', { page: list.data.page, pages: totalPages })}</span>
              <Button type="button" variant="outline" size="sm" className="min-h-11" disabled={address.page >= totalPages} onClick={() => change({ [ARCHIVE_PARAMS.page]: String(address.page + 1) }, true)}>
                {t('complianceArchive.proofs.next')}
                <ChevronRight className="size-4" aria-hidden="true" />
              </Button>
            </nav>
          ) : null}
        </div>
      ) : (
        // No file is not «everything is fine»: the page says only that none is archived for these filters, and where one can be added.
        <EmptyState
          icon={Archive}
          title={t('complianceArchive.proofs.emptyTitle')}
          description={t('complianceArchive.proofs.emptyDescription')}
          action={uploadKinds.length > 0 ? { label: t('complianceArchive.upload.open'), onClick: () => startUpload() } : undefined}
        />
      )}
    </div>
  );

  const summary = (
    <div className="space-y-4" data-testid="archive-summary">
      <div className="flex flex-wrap items-center gap-2">
        {REPORT_FORMATS.map((format) => (
          <Button
            key={format}
            type="button"
            variant="outline"
            size="sm"
            className="min-h-11"
            loading={exportReport.isPending && exportReport.variables?.format === format}
            disabled={busy}
            onClick={() => exportReport.mutate({ format, filters: { from, to, propertyId } })}
            data-testid={`archive-export-report-${format}`}
          >
            <Download className="size-4" aria-hidden="true" />
            {t(`complianceArchive.summary.export.${format}`)}
          </Button>
        ))}
      </div>
      {exportReport.isError ? (
        <Alert variant="danger" role="alert" data-testid="archive-report-export-error">
          {getProblemMessage(exportReport.error, t) ?? t('complianceArchive.summary.exportFailed')}
        </Alert>
      ) : null}

      {!ready || report.isLoading ? (
        <ListSkeleton label={t('complianceArchive.summary.loading')} />
      ) : report.isError ? (
        <ErrorState
          testId="archive-summary-error"
          title={t(getHttpStatus(report.error) === 404 ? 'complianceArchive.summary.notAvailable' : 'complianceArchive.summary.loadError')}
          error={getHttpStatus(report.error) === 404 ? undefined : report.error}
          onRetry={() => void report.refetch()}
        />
      ) : report.data ? (
        <div className={report.isPlaceholderData ? 'opacity-60 transition-opacity' : undefined} aria-busy={report.isPlaceholderData}>
          <ComplianceCoverageReport report={report.data} kind={kind} canUpload={canUpload} onUpload={startUpload} />
        </div>
      ) : null}
    </div>
  );

  return (
    <AppShell>
      <div className="space-y-6" data-testid="compliance-archive-page">
        <PageHeader
          title={t('complianceArchive.title')}
          description={t('complianceArchive.description')}
          crumbs="auto"
          primary={uploadKinds.length > 0 ? { label: t('complianceArchive.upload.open'), icon: Upload, onClick: () => startUpload(), testId: 'archive-upload-open' } : undefined}
          mobilePrimary="none"
        />

        {address.day ? (
          <p className="text-sm" data-testid="archive-day-filter">
            {t('complianceArchive.filters.day', { day: formatPeriod(address.day, language) })}{' '}
            <Button type="button" variant="link" size="sm" className="min-h-11" onClick={() => change({ [ARCHIVE_PARAMS.day]: null })}>
              {t('complianceArchive.filters.clearDay')}
            </Button>
          </p>
        ) : null}

        {filters}

        {hasSummary ? (
          <Tabs label={t('complianceArchive.tabsLabel')} items={tabs} defaultValue="summary" value={address.tab} param={ARCHIVE_PARAMS.tab}>
            {address.tab === 'summary' ? summary : proofs}
          </Tabs>
        ) : (
          proofs
        )}
      </div>

      <ProofUploadDialog
        open={uploading !== null}
        onClose={() => setUploading(null)}
        properties={propertyList}
        kinds={uploadKinds}
        prefill={uploading ?? undefined}
        alloggiatiPortalUrl={list.data?.alloggiatiPortalUrl}
      />
    </AppShell>
  );
}

/** The list while it loads: the shape of the rows, announced once, with no spinner in the middle of nothing. */
function ListSkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-busy="true" className="space-y-3" data-testid="archive-loading">
      <span className="sr-only">{label}</span>
      <div aria-hidden="true" className="space-y-3">
        <Skeleton className="h-20 w-full rounded-xl motion-reduce:animate-none" />
        <Skeleton className="h-20 w-full rounded-xl motion-reduce:animate-none" />
        <Skeleton className="h-20 w-full rounded-xl motion-reduce:animate-none" />
      </div>
    </div>
  );
}
