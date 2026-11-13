import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { downloadPdf, downloadXml, exportList, getDocumentsContext, listDocuments } from '@/api/fiscal-documents.api';
import { documentFileName, exportFileName, isAwaitingSdi } from '@/features/fiscal/documents/document-model';
import { withoutRequest } from '@/features/marketplace/activation/use-sequential-run';
import { useNow } from '@/hooks/use-now';
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
 * How long a page keeps asking by itself for the answer of the SDI: thirty minutes from when it opened, from the moment a document starts to wait (one just sent) or from the last
 * «Controlla di nuovo». The answer of the SDI may take days, and each read works out a page of documents and their collection on the server, so after the window the page stops (no
 * endless polling of a tab left open), says in neutral words that it no longer asks by itself and offers a button that asks again (the same window as the owner invitations,
 * `use-owner-onboarding.ts`, and the changes of the calendar, `use-calendar-changes.ts`).
 */
export const SDI_WATCH_MS = 30 * 60_000;

/**
 * The window in which the page follows the documents that wait for the SDI by itself. `now` is the time as of the last tick, kept in the state of the screen so that nothing reads
 * the clock while it renders.
 */
function useWatchWindow() {
  const [since, setSince] = useState(() => Date.now());
  const now = useNow(SDI_POLL_MS);
  return { since, now, setSince, over: now - since >= SDI_WATCH_MS, restart: () => setSince(Date.now()) };
}

/**
 * Opens the window again when a document that was not waiting starts to wait (an invoice just sent, a document read for the first time): without it the window would run from the
 * opening of the page, and a document sent after more than thirty minutes would be told at once as «no longer checking» and never followed. The state is adjusted while rendering,
 * as React lets a value that follows from what the screen reads (here the ids that wait) be.
 */
function useRestartOnNewWaiting(watch: Pick<ReturnType<typeof useWatchWindow>, 'now' | 'setSince'>, waitingIds: readonly string[]) {
  const [known, setKnown] = useState<readonly string[]>([]);
  const { now, setSince } = watch;
  if (waitingIds.some((id) => !known.includes(id))) {
    setKnown(waitingIds);
    setSince(now);
  } else if (waitingIds.length < known.length) {
    setKnown(waitingIds);
  }
}

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
 * refuse: the server is not asked for what it would refuse. While a document waits for the answer of the SDI the list is read again every {@link SDI_POLL_MS}, for
 * {@link SDI_WATCH_MS} at most (from when the page opened, from the moment a document starts to wait or from the last `checkAgain`): `watchOver` says that the window is over
 * while a document is still waiting. A tab in the background does not ask (`refetchIntervalInBackground: false`), and nothing asks once the page is left.
 */
export function useFiscalDocuments(criteria: FiscalDocumentCriteria, page: number, pageSize: number, options: { enabled?: boolean } = {}) {
  const watch = useWatchWindow();
  const query = useQuery({
    queryKey: [...FISCAL_DOCUMENTS_KEY, 'list', criteria, page, pageSize],
    queryFn: () => listDocuments(criteria, page, pageSize),
    enabled: options.enabled ?? true,
    placeholderData: (previousData, previousQuery) => {
      const before = previousQuery?.queryKey[3];
      return before !== undefined && JSON.stringify(before) === JSON.stringify(criteria) ? previousData : undefined;
    },
    refetchInterval: (current) => (current.state.data?.items.some(isAwaitingSdi) && Date.now() - watch.since < SDI_WATCH_MS ? SDI_POLL_MS : false),
    refetchIntervalInBackground: false,
    ...FRESH,
  });
  const waitingIds = (query.data?.items ?? []).filter(isAwaitingSdi).map((document) => document.id);
  useRestartOnNewWaiting(watch, waitingIds);

  const { refetch } = query;
  return {
    ...query,
    watchOver: watch.over && waitingIds.length > 0,
    checkAgain: () => {
      watch.restart();
      void refetch();
    },
  };
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
