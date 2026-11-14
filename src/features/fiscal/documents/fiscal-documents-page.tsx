import { useMemo, useState } from 'react';
import { FileSpreadsheet, FileText } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { ListPagination } from '@/components/shared/list-view/list-pagination';
import { Button } from '@/components/ui/button';
import { isFeatureEnabled } from '@/config/feature-flags';
import { ISSUER_PATH } from '@/features/fiscal/issuer-wizard/issuer-paths';
import { useFeatureFlags } from '@/hooks/use-feature-flags';
import { useWorkspace } from '@/hooks/use-workspace';
import { getHttpStatus } from '@/lib/api-errors';
import {
  useExportFiscalDocuments,
  useFiscalDocuments,
  useFiscalDocumentsContext,
  useIssueFiscalDocumentsBatch,
  useSelectDraftsOfPeriod,
} from '@/queries/use-fiscal-documents';
import type { FiscalDocumentEntry, FiscalDocumentExportFormat } from '@/types';
import type { DocumentChange } from './document-actions';
import { BatchConfirmDialog, BatchResultDialog, DocumentBatchControls, type SelectNote } from './document-batch';
import { DocumentDetailDrawer } from './document-detail-drawer';
import { DocumentFilterBar } from './document-filters';
import { DocumentList } from './document-list';
import {
  batchOutcomeOf,
  criteriaOf,
  DOCUMENTS_PAGE_SIZE,
  documentLabelOf,
  documentsReadOf,
  exportBlockOf,
  hasActiveFilters,
  issuerModeOf,
  NO_FILTERS,
  periodProblemOf,
  sdiNoteVisibleFor,
  type BatchOutcome,
  type DocumentFilters,
} from './document-model';

const NO_DOCUMENTS: readonly FiscalDocumentEntry[] = [];
const NO_SELECTION: ReadonlyMap<string, FiscalDocumentEntry> = new Map();

/** What a bulk issue came to and the names of its documents as the page knew them when it was asked (a draft that was issued is not in the list any more). */
interface BatchReport {
  outcome: BatchOutcome;
  labels: ReadonlyMap<string, string>;
}

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
 *
 * A click on a row opens the detail of the document (E12/F02/US01/T01). Who may write payments, with the issuance of CasaZen on (`payment.write` and the flag `fiscalDocumentIssuance`), also has the
 * actions of the state of each document, a box on every draft and the bulk issue: «Seleziona tutte le bozze del periodo» ticks the drafts of the filters, «Emetti selezionate» asks for a confirmation
 * and then says what came of every document, never that all went well when one did not. Without either of the two nothing that changes a document is drawn.
 */
export function FiscalDocumentsPage() {
  const { t } = useTranslation();
  const { hasPermission } = useWorkspace();
  const { flags } = useFeatureFlags();
  const canRead = hasPermission('short-rent', 'payment.read');
  const canSeeSetting = canRead && hasPermission('short-rent', 'property.read');
  const canChangeIssuer = hasPermission('short-rent', 'property.write');
  const canReadBookings = hasPermission('short-rent', 'booking.read');
  const canWrite = canRead && hasPermission('short-rent', 'payment.write') && isFeatureEnabled(flags, 'fiscalDocumentIssuance');

  const [filters, setFilters] = useState<DocumentFilters>(NO_FILTERS);
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);
  const [selected, setSelected] = useState<ReadonlyMap<string, FiscalDocumentEntry>>(NO_SELECTION);
  const [note, setNote] = useState<SelectNote | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [report, setReport] = useState<BatchReport | null>(null);
  const problem = periodProblemOf(filters);
  const enabled = canRead && problem === null;
  const criteria = useMemo(() => criteriaOf(filters), [filters]);
  const documents = useFiscalDocuments(criteria, page, DOCUMENTS_PAGE_SIZE, { enabled });
  const context = useFiscalDocumentsContext(canSeeSetting);
  const exporter = useExportFiscalDocuments();
  const batch = useIssueFiscalDocumentsBatch();
  const picker = useSelectDraftsOfPeriod();
  const selectedIds = useMemo(() => new Set(selected.keys()), [selected]);

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
    // What was ticked belongs to the filters it was ticked under: another list never keeps boxes the person can no longer see.
    setSelected(NO_SELECTION);
    setNote(null);
  };
  const reset = () => change(NO_FILTERS);
  const exportBlock = exportBlockOf(filters);

  const toggle = (document: FiscalDocumentEntry) =>
    setSelected((current) => {
      const next = new Map(current);
      if (next.has(document.id)) next.delete(document.id);
      else next.set(document.id, document);
      return next;
    });
  const togglePage = (pageDocuments: readonly FiscalDocumentEntry[], select: boolean) =>
    setSelected((current) => {
      const next = new Map(current);
      for (const document of pageDocuments) {
        if (select) next.set(document.id, document);
        else next.delete(document.id);
      }
      return next;
    });
  const clearSelection = () => {
    setSelected(NO_SELECTION);
    setNote(null);
  };
  // The drafts of the stays that the filters show (the status of the filter is not read: only drafts are asked for), at most the 200 a bulk issue takes.
  const selectPeriod = () => {
    setNote(null);
    picker.mutate(criteria, {
      onSuccess: ({ drafts, more }) => {
        if (drafts.length === 0) {
          setNote({ kind: 'none' });
          return;
        }
        setSelected(new Map(drafts.map((draft) => [draft.id, draft])));
        setNote({ kind: 'selected', count: drafts.length, more });
      },
      onError: () => setNote({ kind: 'failed' }),
    });
  };
  // Issues the ticked drafts. What was issued leaves the selection; what was not stays ticked, so the person can mend it and ask again.
  const issueSelected = async () => {
    const labels = new Map([...selected].map(([id, draft]) => [id, documentLabelOf(t, draft)] as const));
    const result = await batch.mutateAsync({ documentIds: [...selected.keys()] });
    setSelected((current) => {
      const next = new Map(current);
      for (const row of result.rows) if (row.issued) next.delete(row.id);
      return next;
    });
    setReport({ outcome: batchOutcomeOf(result), labels });
  };
  // What a button of a document did to it: an issued or dropped draft is no draft to issue in bulk any more, and a dropped one has no detail to show.
  const changed = (id: string, kind: DocumentChange) => {
    if (kind !== 'credited') {
      setSelected((current) => {
        if (!current.has(id)) return current;
        const next = new Map(current);
        next.delete(id);
        return next;
      });
    }
    if (kind === 'discarded') setOpenId((current) => (current === id ? null : current));
  };
  const canSelectPeriod = read === 'ok' && problem === null && (filters.status === '' || filters.status === 'Draft');

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

            {/* The page asked by itself for the answer of the SDI for a while and stopped (no endless polling of a tab left open): it says so in neutral words, never as a failure. */}
            {read === 'ok' && documents.watchOver ? (
              <div className="flex flex-wrap items-center gap-3 text-sm text-foreground/70" data-testid="fiscal-documents-watch-over">
                <p>{t('fiscalDocuments.list.watch.over')}</p>
                <Button type="button" variant="outline" size="sm" disabled={documents.isFetching} onClick={documents.checkAgain} data-testid="fiscal-documents-check-again">
                  {t('fiscalDocuments.list.watch.checkAgain')}
                </Button>
              </div>
            ) : null}

            {canWrite && read === 'ok' ? (
              <DocumentBatchControls
                count={selected.size}
                canSelectPeriod={canSelectPeriod}
                searching={picker.isPending}
                issuing={batch.isPending}
                note={note}
                onSelectPeriod={selectPeriod}
                onIssue={() => setConfirming(true)}
                onClear={clearSelection}
              />
            ) : null}

            {problem === null ? (
              <DocumentList
                documents={rows}
                label={t('fiscalDocuments.list.tableLabel')}
                canReadBookings={canReadBookings}
                flags={flags}
                canWrite={canWrite}
                onOpen={(document) => setOpenId(document.id)}
                onChanged={changed}
                selection={
                  canWrite
                    ? { selected: selectedIds, disabled: picker.isPending || batch.isPending, onToggle: toggle, onTogglePage: togglePage }
                    : undefined
                }
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

            <DocumentDetailDrawer
              documentId={openId}
              onClose={() => setOpenId(null)}
              flags={flags}
              canWrite={canWrite}
              canReadBookings={canReadBookings}
              onChanged={changed}
            />

            {confirming ? (
              <BatchConfirmDialog
                count={selected.size}
                busy={batch.isPending}
                onClose={() => setConfirming(false)}
                onConfirm={async () => {
                  await issueSelected();
                  setConfirming(false);
                }}
              />
            ) : null}
            {report ? (
              <BatchResultDialog
                outcome={report.outcome}
                labelOf={(id) => report.labels.get(id) ?? t('fiscalDocuments.batch.result.unknownDocument')}
                onClose={() => setReport(null)}
              />
            ) : null}
          </>
        )}
      </div>
    </AppShell>
  );
}
