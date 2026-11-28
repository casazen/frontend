import { AxiosError, isAxiosError } from 'axios';
import axios from '@/lib/axios';
import { getProblemCode, UnexpectedApiResponseError } from '@/lib/api-errors';
import { withJsonErrorBody } from '@/lib/file-download';
import type {
  ArchiveDocumentPage,
  ArchiveDocumentType,
  ArchiveDownload,
  ArchiveExportQuery,
  ArchiveExportTooLarge,
  ArchiveListQuery,
  ArchiveTypeCount,
  ArchiveTypesQuery,
} from '@/types';
import { headerOf } from '@/api/response-helpers';

const PATH = '/documents';

export const ARCHIVE_ERROR = {
  notFound: 'archive_document_not_found',
  noFile: 'archive_document_has_no_file',
  tooLarge: 'archive_export_too_large',
} as const;

const MAX_SEARCH_LENGTH = 100;

const DOWNLOAD_TIMEOUT_MS = 120_000;

const EXPORT_TIMEOUT_MS = 10 * 60_000;

export function archiveExportFileName(from: string, to: string): string {
  return `casazen-documenti-${from.replaceAll('-', '')}-${to.replaceAll('-', '')}.zip`;
}

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

export function archiveListParams(query: ArchiveListQuery): URLSearchParams {
  const params = new URLSearchParams();
  appendTypes(params, query.types);
  appendFilters(params, query);
  params.set('page', String(query.page));
  params.set('pageSize', String(query.pageSize));
  return params;
}

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

export function archiveErrorCode(error: unknown): string | undefined {
  return isAxiosError(error) ? getProblemCode(error.response?.data) : undefined;
}

export function isArchiveCallCancelled(error: unknown): boolean {
  return isAxiosError(error) && error.code === AxiosError.ERR_CANCELED;
}

function wholeNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : null;
}

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

export const documentArchiveApi = {
  list: async (query: ArchiveListQuery): Promise<ArchiveDocumentPage> => {
    const res = await axios.get<unknown>(PATH, { params: archiveListParams(query) });
    return asPage(res.data);
  },

  types: async (query: ArchiveTypesQuery): Promise<ArchiveTypeCount[]> => {
    const params = new URLSearchParams();
    appendFilters(params, query);
    const res = await axios.get<unknown>(`${PATH}/types`, { params });
    return asTypes(res.data);
  },

  /**
   * The file of one document, with the name the server gave it (`Content-Disposition`, which the API exposes to the page: `null` when it does not,
   * and the name is then rebuilt from the row); a problem body (a JSON Blob) is parsed so that its code can be read.
   */
  download: async (type: ArchiveDocumentType, id: string): Promise<ArchiveDownload> => {
    try {
      const res = await axios.get<Blob>(`${PATH}/${encodeURIComponent(type)}/${encodeURIComponent(id)}/download`, {
        responseType: 'blob',
        timeout: DOWNLOAD_TIMEOUT_MS,
      });
      return { blob: res.data, contentDisposition: headerOf(res.headers, 'content-disposition') };
    } catch (error) {
      throw await withJsonErrorBody(error);
    }
  },

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
