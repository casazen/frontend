import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { downloadPdf, downloadXml, exportList, getDocumentsContext, listDocuments } from '@/api/fiscal-documents.api';
import { documentFileName, exportFileName, isAwaitingSdi } from '@/features/fiscal/documents/document-model';
import { withoutRequest } from '@/features/marketplace/activation/use-sequential-run';
import i18n from '@/i18n/config';
import { getHttpStatus, getProblemMessage } from '@/lib/api-errors';
import { saveBlobAs } from '@/lib/file-download';
import type { FiscalDocumentCriteria, FiscalDocumentEntry, FiscalDocumentExportFormat } from '@/types';

/**
 * Root of the query keys of the fiscal documents. It is under `fiscal` on purpose: a change to the tax profile or to who issues (`FISCAL_ISSUER_KEY`, which lives under
 * `['fiscal', 'documents']` too) reads the documents again.
 */
export const FISCAL_DOCUMENTS_KEY = ['fiscal', 'documents'] as const;

/** How often an open list is read again while a document waits for the answer of the SDI: the answer comes without any screen asking for it. */
export const SDI_POLL_MS = 60_000;

/**
 * What the list holds is money and the data of the people who were billed, and it changes from other screens (a document issued or credited, a payment collected) and
 * without any screen at all (the SDI answers): it is read again whenever the page opens and whenever the window is looked at again (`staleTime: 0`,
 * `refetchOnMount: 'always'`), and it is not kept once nothing shows it (`gcTime: 0`): a list that was left is never shown again as if it were current, and the names of the
 * recipients do not stay in the browser.
 */
const FRESH = { staleTime: 0, gcTime: 0, refetchOnMount: 'always' } as const;

/**
 * One page of the documents of the caller. The page before stays on screen, quieter, while the next one of the same filters is read (`isPlaceholderData`), so the table does
 * not flash; the documents of other filters are never shown for these. `enabled: false` for who may not read payments (`payment.read`) and for days the server would
 * refuse: the server is not asked for what it would refuse. While a document waits for the answer of the SDI the list is read again every {@link SDI_POLL_MS}.
 */
export function useFiscalDocuments(criteria: FiscalDocumentCriteria, page: number, pageSize: number, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: [...FISCAL_DOCUMENTS_KEY, 'list', criteria, page, pageSize],
    queryFn: () => listDocuments(criteria, page, pageSize),
    enabled: options.enabled ?? true,
    placeholderData: (previousData, previousQuery) => {
      const before = previousQuery?.queryKey[3];
      return before !== undefined && JSON.stringify(before) === JSON.stringify(criteria) ? previousData : undefined;
    },
    refetchInterval: (query) => (query.state.data?.items.some(isAwaitingSdi) ? SDI_POLL_MS : false),
    ...FRESH,
  });
}

/**
 * How the documents are issued, as far as the page needs it (who issues, whether CasaZen has a channel to the SDI). Asked only by who holds `property.read` and
 * `payment.read` (`enabled`): the answer is read again like the list and is not kept.
 */
export function useFiscalDocumentsContext(enabled = true) {
  return useQuery({
    queryKey: [...FISCAL_DOCUMENTS_KEY, 'context'],
    queryFn: () => getDocumentsContext(),
    enabled,
    ...FRESH,
  });
}

interface DownloadRequest {
  document: FiscalDocumentEntry;
  format: 'pdf' | 'xml';
}

/** What a download that failed says: the words of the server for its code (`apiErrors.codes.*`), and for a 404 that a document is not found, never a generic failure. */
function downloadFailure(error: unknown): string {
  return getProblemMessage(error, i18n.t) ?? i18n.t(getHttpStatus(error) === 404 ? 'fiscalDocuments.list.download.notFound' : 'fiscalDocuments.list.download.failed');
}

/**
 * Downloads the PDF or the XML of one document and saves it. A document is money and the data of a person: the mutation keeps nothing of it once nobody watches it
 * (`gcTime: 0`), what its function hands back is nothing (the file goes to the disk inside it, never into the cache of the mutations, and the address that was made for it is
 * released at once) and a failure is kept without its request, which holds the access token of the caller (`withoutRequest`). A document that is not found any more
 * (404) is told as such, whatever the list still shows, and the list is read again, so the row goes away.
 */
export function useDownloadFiscalDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ document, format }: DownloadRequest): Promise<void> => {
      try {
        const file = format === 'pdf' ? await downloadPdf(document) : await downloadXml(document);
        saveBlobAs(file.blob, documentFileName(document, format, file.contentDisposition));
      } catch (error) {
        throw withoutRequest(error);
      }
    },
    gcTime: 0,
    onSuccess: () => {
      toast.success(i18n.t('fiscalDocuments.list.download.done'));
    },
    onError: (error) => {
      toast.error(downloadFailure(error));
      if (getHttpStatus(error) === 404) void queryClient.invalidateQueries({ queryKey: [...FISCAL_DOCUMENTS_KEY, 'list'] });
    },
  });
}

interface ExportRequest {
  format: FiscalDocumentExportFormat;
  criteria: FiscalDocumentCriteria;
}

/**
 * Downloads the list as a CSV or an Excel file and saves it, with the days, the kind and the source of the filters. Like a single document it keeps nothing once nobody
 * watches it (`gcTime: 0`), saves inside its function and keeps a failure without its request. A refusal of the server (days it does not accept, a list longer than a file
 * holds) is told with its own words.
 */
export function useExportFiscalDocuments() {
  return useMutation({
    mutationFn: async ({ format, criteria }: ExportRequest): Promise<void> => {
      try {
        const file = await exportList(format, criteria);
        saveBlobAs(file.blob, exportFileName(format, criteria, file.contentDisposition));
      } catch (error) {
        throw withoutRequest(error);
      }
    },
    gcTime: 0,
    onSuccess: () => {
      toast.success(i18n.t('fiscalDocuments.list.download.done'));
    },
    onError: (error) => {
      toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('fiscalDocuments.list.export.failed'));
    },
  });
}
