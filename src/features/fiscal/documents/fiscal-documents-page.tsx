import { useMemo, useState } from 'react';
import { FileSpreadsheet, FileText } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { ListPagination } from '@/components/shared/list-view/list-pagination';
import { Button } from '@/components/ui/button';
import { ISSUER_PATH } from '@/features/fiscal/issuer-wizard/issuer-paths';
import { useFeatureFlags } from '@/hooks/use-feature-flags';
import { useWorkspace } from '@/hooks/use-workspace';
import { getHttpStatus } from '@/lib/api-errors';
import { useExportFiscalDocuments, useFiscalDocuments, useFiscalDocumentsContext } from '@/queries/use-fiscal-documents';
import type { FiscalDocumentEntry, FiscalDocumentExportFormat } from '@/types';
import { DocumentFilterBar } from './document-filters';
import { DocumentList } from './document-list';
import {
  criteriaOf,
  DOCUMENTS_PAGE_SIZE,
  documentsReadOf,
  exportBlockOf,
  hasActiveFilters,
  issuerModeOf,
  NO_FILTERS,
  periodProblemOf,
  sdiNoteVisibleFor,
  type DocumentFilters,
} from './document-model';

const NO_DOCUMENTS: readonly FiscalDocumentEntry[] = [];

interface ExportActionsProps {
  /** The files cannot be asked now (a period with a problem, a status that has no file): both buttons wait. */
  blocked: boolean;
  /** A file is on the way and which one: both buttons wait for it, so a second click cannot start a second file. */
  pending: boolean;
  format: FiscalDocumentExportFormat | undefined;
  onExport: (format: FiscalDocumentExportFormat) => void;
}

/** The two files of the list, side by side in the header: the buttons of one card wait for each other while a file is on the way. */
function ExportActions({ blocked, pending, format, onExport }: ExportActionsProps) {
  const { t } = useTranslation();

  return (
    <div role="group" aria-label={t('fiscalDocuments.list.export.label')} className="flex flex-wrap items-center gap-2" data-testid="fiscal-documents-export">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={blocked || pending}
        loading={pending && format === 'csv'}
        onClick={() => onExport('csv')}
        data-testid="fiscal-documents-export-csv"
      >
        <FileText className="size-4" aria-hidden="true" />
        {t('fiscalDocuments.list.export.csv')}
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={blocked || pending}
        loading={pending && format === 'xlsx'}
        onClick={() => onExport('xlsx')}
        data-testid="fiscal-documents-export-xlsx"
      >
        <FileSpreadsheet className="size-4" aria-hidden="true" />
        {t('fiscalDocuments.list.export.xlsx')}
      </Button>
    </div>
  );
}

/**
 * The fiscal documents of the host (FIS-04, FIS-07, NF-84, NF-87, E06/F03/US04/T01): the list of the ones CasaZen issued for its direct bookings and of the ones imported from
 * the channel manager (read-only), with the state of each in simple words, the PDF and the XML to download, and the CSV and the Excel file of the filtered list. A tab of Incassi
 * next to «Regime fiscale».
 *
 * It is for who may read payments (`payment.read`, the permission of the API for the list and the files; the route asks `property.read` as well, which the setting that tells who
 * issues needs): without it nothing is asked, and a refusal of the server (403) is told in words in the page and does not send the person to the no-access page. A read that
 * failed is a failed read, with a retry, and is never an empty list; a 404 is «not found» whatever the query still holds. The filters and the page are in the screen and nowhere else:
 * not in the address, not in the browser's storage. The list is read again whenever it opens, and while a document waits for the answer of the SDI.
 */
export function FiscalDocumentsPage() {
  const { t } = useTranslation();
  const { hasPermission } = useWorkspace();
  const { flags } = useFeatureFlags();
  const canRead = hasPermission('short-rent', 'payment.read');
  const canSeeSetting = canRead && hasPermission('short-rent', 'property.read');
  const canChangeIssuer = hasPermission('short-rent', 'property.write');
  const canReadBookings = hasPermission('short-rent', 'booking.read');

  const [filters, setFilters] = useState<DocumentFilters>(NO_FILTERS);
  const [page, setPage] = useState(1);
  const problem = periodProblemOf(filters);
  const enabled = canRead && problem === null;
  const criteria = useMemo(() => criteriaOf(filters), [filters]);
  const documents = useFiscalDocuments(criteria, page, DOCUMENTS_PAGE_SIZE, { enabled });
  const context = useFiscalDocumentsContext(canSeeSetting);
  const exporter = useExportFiscalDocuments();

  const read = documentsReadOf({ enabled, isError: documents.isError, status: getHttpStatus(documents.error), hasData: documents.data !== undefined });
  const data = read === 'ok' ? documents.data : undefined;
  const rows = data?.items ?? NO_DOCUMENTS;
  const refused = !canRead || read === 'forbidden';

  // A page past the end (the documents of the filters went down while the page was open) goes to the last one that has any.
  if (data && page > 1 && data.items.length === 0 && data.totalCount > 0 && !documents.isPlaceholderData) {
    setPage(Math.ceil(data.totalCount / DOCUMENTS_PAGE_SIZE));
  }

  const change = (next: DocumentFilters) => {
    setFilters(next);
    setPage(1);
  };
  const reset = () => change(NO_FILTERS);
  const exportBlock = exportBlockOf(filters);

  const filtered = hasActiveFilters(filters);
  const issuerMode = issuerModeOf(context.data);
  const empty = filtered
    ? {
        icon: FileText,
        title: t('fiscalDocuments.list.empty.filteredTitle'),
        description: t('fiscalDocuments.list.empty.filteredDescription'),
        action: { label: t('fiscalDocuments.list.filters.reset'), onClick: reset },
      }
    : {
        icon: FileText,
        title: t('fiscalDocuments.list.empty.title'),
        description: t(`fiscalDocuments.list.empty.mode.${issuerMode}`),
        // Whoever may not change who issues has no button to it: the wizard asks `property.write`, and the button never leads where the guard says no.
        action: canChangeIssuer ? { label: t('fiscalDocuments.list.empty.action'), href: ISSUER_PATH } : undefined,
      };

  return (
    <AppShell>
      <div className="space-y-6" data-testid="fiscal-documents-page">
        <PageHeader
          title={t('fiscalDocuments.list.title')}
          description={t('fiscalDocuments.list.description')}
          crumbs="auto"
          action={
            refused ? undefined : (
              <ExportActions
                blocked={exportBlock !== null}
                pending={exporter.isPending}
                format={exporter.variables?.format}
                onExport={(format) => exporter.mutate({ format, criteria })}
              />
            )
          }
        />

        {refused ? (
          // The server refused (or the person may not read payments): told here, in words, with no retry and no list. The shared client does not move the person to the no-access page.
          <p className="rounded-xl border border-border bg-card px-6 py-8 text-center text-sm text-foreground/70" data-testid="fiscal-documents-forbidden">
            {t('fiscalDocuments.list.forbidden')}
          </p>
        ) : (
          <>
            <DocumentFilterBar filters={filters} problem={problem} onChange={change} onReset={reset} />

            <p className="text-sm text-foreground/70" data-testid="fiscal-documents-export-hint">
              {t(exportBlock === 'status' ? 'fiscalDocuments.list.export.statusBlocked' : 'fiscalDocuments.list.export.hint')}
            </p>

            {read === 'ok' && sdiNoteVisibleFor(context.data, rows) ? (
              <p className="text-sm text-foreground/70" data-testid="fiscal-documents-sdi-note">
                {t('fiscalDocuments.list.note.sdiNotAvailable')}
              </p>
            ) : null}

            {problem === null ? (
              <DocumentList
                documents={rows}
                label={t('fiscalDocuments.list.tableLabel')}
                canReadBookings={canReadBookings}
                flags={flags}
                // Whatever the failure, a list that could not be read is never drawn as an empty one, and a 404 is never the rows a query still holds.
                isLoading={read === 'loading'}
                isError={read === 'failed' || read === 'notFound'}
                error={documents.error}
                errorTitle={t(read === 'notFound' ? 'fiscalDocuments.list.notFound' : 'fiscalDocuments.list.loadError')}
                onRetry={() => void documents.refetch()}
                // Only the page or the filters that changed dim the rows: the read that runs by itself (the window looked at again, a document waiting for the SDI) does not make them flicker.
                isRefreshing={documents.isPlaceholderData}
                empty={empty}
                footer={
                  data && data.totalCount > 0 ? (
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-sm text-foreground/70" data-testid="fiscal-documents-count">
                        {t('fiscalDocuments.list.count', { count: data.totalCount })}
                      </p>
                      <ListPagination page={page} pageSize={DOCUMENTS_PAGE_SIZE} totalCount={data.totalCount} onPageChange={setPage} />
                    </div>
                  ) : null
                }
              />
            ) : null}
          </>
        )}
      </div>
    </AppShell>
  );
}
