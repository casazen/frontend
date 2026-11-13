import { isAxiosError } from 'axios';
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

function appendTypes(params: URLSearchParams, types: readonly ArchiveDocumentType[] | undefined) {
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
 * What the 422 `archive_export_too_large` says, or `null` for any other error: the number of files the period holds, when the server sends
 * a number (`fileCount`), so that the person is told how many were found and asked for a shorter period.
 */
export function archiveExportTooLarge(error: unknown): ArchiveExportTooLarge | null {
  if (!isAxiosError(error) || error.response?.status !== 422 || archiveErrorCode(error) !== ARCHIVE_ERROR.tooLarge) return null;
  const body = error.response.data as Record<string, unknown>;
  const count = body.fileCount;
  return { fileCount: typeof count === 'number' && Number.isFinite(count) && count >= 0 ? Math.floor(count) : null };
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
