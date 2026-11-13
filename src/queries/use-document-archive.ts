import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ARCHIVE_ERROR, archiveErrorCode, archiveExportFileName, documentArchiveApi, isArchiveCallCancelled } from '@/api/document-archive.api';
import { archiveDownloadFileName } from '@/features/document-archive/document-file';
import { withoutRequest } from '@/features/marketplace/activation/use-sequential-run';
import i18n from '@/i18n/config';
import { getProblemMessage } from '@/lib/api-errors';
import { saveBlobAs } from '@/lib/file-download';
import type { ArchiveDocument, ArchiveExportQuery, ArchiveListQuery, ArchiveTypesQuery } from '@/types';

/** Root of every query key of the document archive. */
export const DOCUMENT_ARCHIVE_KEY = 'document-archive';

/**
 * One page of the documents the caller may read (NF-99), filtered, searched and paged by the server. The archive changes on other screens
 * (a document is uploaded to a property, a lease, a tourist tax payment), none of which knows it: the query client does not read again on
 * mount, and a read less than five minutes old would still be taken for fresh, so every visit of the page reads again (`'always'`) and so
 * does a return to the tab (`staleTime: 0`). The rows of the last page stay on the screen, dimmed, until those of the next one arrive.
 * `enabled` is false while the page waits for what its filters are made of (the properties, the types).
 */
export function useDocuments(query: ArchiveListQuery, enabled = true) {
  return useQuery({
    queryKey: [DOCUMENT_ARCHIVE_KEY, 'list', query],
    queryFn: () => documentArchiveApi.list(query),
    enabled,
    placeholderData: keepPreviousData,
    refetchOnMount: 'always',
    staleTime: 0,
  });
}

/**
 * The types the caller may read, each with how many documents match `query` (the type itself left out of it). The server never sends a type
 * the caller may not read, so the page offers exactly these and no other. Read again on every visit and every return to the tab, like the list.
 */
export function useDocumentTypes(query: ArchiveTypesQuery, enabled = true) {
  return useQuery({
    queryKey: [DOCUMENT_ARCHIVE_KEY, 'types', query],
    queryFn: () => documentArchiveApi.types(query),
    enabled,
    placeholderData: keepPreviousData,
    refetchOnMount: 'always',
    staleTime: 0,
  });
}

/**
 * Downloads one document and saves it. A file can be a contract, a receipt or a proof about guests: the mutation keeps nothing of it once
 * nobody watches it (`gcTime: 0`), and what its function hands back is nothing: the file goes to the disk inside it, never into the cache
 * of the mutations. What the cache keeps of a failure is the answer (status, code, body) and not the request, which holds the access token
 * of the caller (`withoutRequest`). A document that is not found any more (404 `archive_document_not_found`: deleted, or out of the reach
 * of the caller) is told as such, whatever the list still shows, and the list is read again, so the row goes away; a row with no file (404
 * `archive_document_has_no_file`) is told to the page by the error, which marks it. Everything else is told in plain words.
 */
export function useDownloadArchiveDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (document: ArchiveDocument): Promise<void> => {
      try {
        const { blob, contentDisposition } = await documentArchiveApi.download(document.type, document.id);
        saveBlobAs(blob, archiveDownloadFileName(document, blob.type, contentDisposition));
      } catch (error) {
        throw withoutRequest(error);
      }
    },
    gcTime: 0,
    onSuccess: () => {
      toast.success(i18n.t('documentArchive.downloadDone'));
    },
    onError: (error) => {
      if (isArchiveCallCancelled(error)) return;
      toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('documentArchive.downloadFailed'));
      if (archiveErrorCode(error) === ARCHIVE_ERROR.notFound) void queryClient.invalidateQueries({ queryKey: [DOCUMENT_ARCHIVE_KEY] });
    },
  });
}

/** What the export needs besides the period: a way to stop it, and to hear how many bytes of the ZIP came so far. */
interface ExportRequest {
  query: ArchiveExportQuery;
  signal?: AbortSignal;
  onProgress?: (bytes: number) => void;
}

/**
 * Downloads the ZIP of a period and saves it. Like a single document it keeps nothing once nobody watches it (`gcTime: 0`), saves inside
 * its function and keeps a failure without its request. It says nothing itself: the dialog that asks for it tells the refusals (422
 * `archive_export_too_large` with the number of files, a period the server does not accept) next to the button, and a cancelled call is
 * not a failure.
 */
export function useExportArchive() {
  return useMutation({
    mutationFn: async ({ query, signal, onProgress }: ExportRequest): Promise<void> => {
      try {
        const blob = await documentArchiveApi.export(query, { signal, onProgress });
        saveBlobAs(blob, archiveExportFileName(query.from, query.to));
      } catch (error) {
        throw withoutRequest(error);
      }
    },
    gcTime: 0,
  });
}
