import { AxiosError, isAxiosError } from 'axios';
import axios from '@/lib/axios';
import { getProblemCode, UnexpectedApiResponseError } from '@/lib/api-errors';
import { withJsonErrorBody } from '@/lib/file-download';
import type {
  ArchiveDocumentPage,
  ArchiveDocumentType,
  ArchiveExportQuery,
  ArchiveExportTooLarge,
  ArchiveListQuery,
  ArchiveTypeCount,
  ArchiveTypesQuery,
} from '@/types';

const PATH = '/documents';

/** The codes of the problems of the archive (`DocumentArchiveService`): the screens tell each one in its own words. */
export const ARCHIVE_ERROR = {
  /** 404: the document is missing, of another organisation or of a property the caller does not reach (the same answer for all three). */
  notFound: 'archive_document_not_found',
  /** 404: the row exists, its file does not (or it is gone from the storage). */
  noFile: 'archive_document_has_no_file',
  /** 422: the period holds more files than one archive may. */
  tooLarge: 'archive_export_too_large',
} as const;

/** The longest search the archive looks for: a longer text is cut by the server, and here before it is sent. */
const MAX_SEARCH_LENGTH = 100;

/** A file of the archive is up to 20 MB: more than the 30 s of every other call, on a connection that is not fast. */
const DOWNLOAD_TIMEOUT_MS = 120_000;

/** An archive is streamed while the server reads the files one by one: up to 200 MB by default, so it may take minutes. */
const EXPORT_TIMEOUT_MS = 10 * 60_000;

/**
 * Name of the downloaded archive, written as the server names it (`casazen-documenti-20260101-20261231.zip`): the browser does not let the
 * page read the name that comes in the headers.
 */
export function archiveExportFileName(from: string, to: string): string {
  return `casazen-documenti-${from.replaceAll('-', '')}-${to.replaceAll('-', '')}.zip`;
}

/** `type=a&type=b`: the API reads a repeated word, and axios would write `type[]=a`. What is empty is not sent. */
function appendFilters(params: URLSearchParams, filters: ArchiveTypesQuery) {
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);
  if (filters.propertyId) params.set('propertyId', filters.propertyId);
  const text = filters.q?.trim().slice(0, MAX_SEARCH_LENGTH).trim();
  if (text) params.set('q', text);
}

/**
 * No `type` at all is every type the caller may read, so an empty list must never be written as that: it is a mistake of the caller (who
 * asks for none has nothing to ask), and it fails here instead of widening what comes back.
 */
function appendTypes(params: URLSearchParams, types: readonly ArchiveDocumentType[] | undefined) {
  if (types?.length === 0) throw new RangeError('An empty list of types is not "every type": leave `types` out to ask for all of them.');
  for (const type of types ?? []) params.append('type', type);
}

/** The query string of `GET api/documents`. */
export function archiveListParams(query: ArchiveListQuery): URLSearchParams {
  const params = new URLSearchParams();
  appendTypes(params, query.types);
  appendFilters(params, query);
  params.set('page', String(query.page));
  params.set('pageSize', String(query.pageSize));
  return params;
}

/** The query string of `GET api/documents/export`: the days, the types and the property, no search and no page. */
export function archiveExportParams(query: ArchiveExportQuery): URLSearchParams {
  const params = new URLSearchParams();
  appendTypes(params, query.types);
  params.set('from', query.from);
  params.set('to', query.to);
  if (query.propertyId) params.set('propertyId', query.propertyId);
  return params;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** A read that did not come back as a page of documents (the page of another kind an odd proxy sends) is an error to show, not rows to draw. */
function asPage(data: unknown): ArchiveDocumentPage {
  const page = isRecord(data) ? data : null;
  const items = page?.items;
  if (
    !page ||
    !Array.isArray(items) ||
    typeof page.totalCount !== 'number' ||
    items.some((item) => !isRecord(item) || typeof item.id !== 'string' || typeof item.type !== 'string' || typeof item.title !== 'string' || typeof item.date !== 'string')
  ) {
    throw new UnexpectedApiResponseError(PATH);
  }
  return data as ArchiveDocumentPage;
}

function asTypes(data: unknown): ArchiveTypeCount[] {
  const types = isRecord(data) ? data.types : null;
  if (!Array.isArray(types) || types.some((entry) => !isRecord(entry) || typeof entry.type !== 'string' || typeof entry.count !== 'number')) {
    throw new UnexpectedApiResponseError(`${PATH}/types`);
  }
  return types as ArchiveTypeCount[];
}

/** The code of the problem a failed call carries (a JSON body that `withJsonErrorBody` has parsed), or `undefined`. */
export function archiveErrorCode(error: unknown): string | undefined {
  return isAxiosError(error) ? getProblemCode(error.response?.data) : undefined;
}

/**
 * A call the person stopped (the dialog of the archive was closed while it came): not a failure to tell. The code is what is read, not the mark
 * of `axios.isCancel`: the mutations keep a failure without its request (`withoutRequest`), which builds the error again and loses the mark.
 */
export function isArchiveCallCancelled(error: unknown): boolean {
  return isAxiosError(error) && error.code === AxiosError.ERR_CANCELED;
}

/** A count the server sends (`fileCount`, `maxFiles`, `maxBytes`): a whole number from zero, or `null` for anything else. */
function wholeNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : null;
}

/**
 * What the 422 `archive_export_too_large` says, or `null` for any other error. The server refuses an archive with more documents than
 * `maxFiles` and one that is larger than `maxBytes` (a document that stores no size counts as 10 MB there: with the default 200 MB, 21 property
 * documents are already too large) with the same code and the number of documents it found: more than `maxFiles` is "too many files", up to
 * `maxFiles` it is the size. With a number missing the page cannot tell which limit it was, and says only that the archive would be too large.
 */
export function archiveExportTooLarge(error: unknown): ArchiveExportTooLarge | null {
  if (!isAxiosError(error) || error.response?.status !== 422 || archiveErrorCode(error) !== ARCHIVE_ERROR.tooLarge) return null;
  const body = error.response.data as Record<string, unknown>;
  const fileCount = wholeNumber(body.fileCount);
  const maxFiles = wholeNumber(body.maxFiles);
  const maxBytes = wholeNumber(body.maxBytes);
  if (fileCount === null || maxFiles === null) return { limit: null };
  if (fileCount > maxFiles) return { limit: 'files', fileCount, maxFiles };
  return maxBytes === null ? { limit: null } : { limit: 'size', fileCount, maxFiles, maxBytes };
}

/** The document archive (NF-99, REP-04): what the caller may read in one place, one file at a time or as a ZIP of a period. */
export const documentArchiveApi = {
  /** A page of the documents of the caller, newest day first (the server decides what the caller may read, and in which properties). */
  list: async (query: ArchiveListQuery): Promise<ArchiveDocumentPage> => {
    const res = await axios.get<unknown>(PATH, { params: archiveListParams(query) });
    return asPage(res.data);
  },

  /** The types the caller may read, each with how many documents match the filters (the type itself is the one thing left out of them). */
  types: async (query: ArchiveTypesQuery): Promise<ArchiveTypeCount[]> => {
    const params = new URLSearchParams();
    appendFilters(params, query);
    const res = await axios.get<unknown>(`${PATH}/types`, { params });
    return asTypes(res.data);
  },

  /** The file of one document; a problem body (a JSON Blob) is parsed so that its code can be read. */
  download: async (type: ArchiveDocumentType, id: string): Promise<Blob> => {
    try {
      const res = await axios.get<Blob>(`${PATH}/${encodeURIComponent(type)}/${encodeURIComponent(id)}/download`, {
        responseType: 'blob',
        timeout: DOWNLOAD_TIMEOUT_MS,
      });
      return res.data;
    } catch (error) {
      throw await withJsonErrorBody(error);
    }
  },

  /**
   * The ZIP of a period: a folder for each type and the index in CSV. The call can be cancelled (`signal`) and tells how many bytes came so far
   * (`onProgress`); the server refuses an archive that is too large before the first byte (422, see {@link archiveExportTooLarge}).
   */
  export: async (query: ArchiveExportQuery, options: { signal?: AbortSignal; onProgress?: (bytes: number) => void } = {}): Promise<Blob> => {
    try {
      const res = await axios.get<Blob>(`${PATH}/export`, {
        params: archiveExportParams(query),
        responseType: 'blob',
        timeout: EXPORT_TIMEOUT_MS,
        signal: options.signal,
        onDownloadProgress: (event) => options.onProgress?.(event.loaded),
      });
      return res.data;
    } catch (error) {
      throw await withJsonErrorBody(error);
    }
  },
};
