import { isAxiosError } from 'axios';
import axios from '@/lib/axios';
import { getProblemCode, UnexpectedApiResponseError } from '@/lib/api-errors';
import { withJsonErrorBody } from '@/lib/file-download';
import type { AgencySummary } from '@/types';
import { acceptsRefusal } from './accept-refusal';
import type { DownloadedFile } from './file.api';
import { ReportAccessDeniedError } from './report-files';

const PATH = '/accountant-package';

/** 422: the package would hold more files, or more bytes, than one archive may (`DocumentArchive:MaxExportFiles`, `MaxExportBytes`; `AccountantPackageErrors.TooLarge` of the backend). */
const TOO_LARGE_CODE = 'accountant_package_too_large';

/** The ZIP is streamed while the server builds it, up to the caps of the document archive (200 MB by default): it may take minutes, not the 30 s of every other call. */
const DOWNLOAD_TIMEOUT_MS = 10 * 60_000;

/** A file answer that says it is a web page or a JSON body is not the ZIP that was asked for (the `index.html` of a wrong rewrite). */
const NOT_A_FILE = /^(text\/html|application\/(json|problem\+json))/i;

/**
 * Name of the downloaded package, written as the server names it (`casazen-commercialista-2026-10.zip`): the name of the file is built from the same period, so the page falls back to it
 * when the header that carries it cannot be read.
 */
export function accountantPackageFileName(period: string): string {
  return `casazen-commercialista-${period}.zip`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** The value of a header of an answer, whatever the case of its name, or `null` (a browser lets a page read only the headers that the API exposes). */
function headerOf(headers: unknown, name: string): string | null {
  if (!isRecord(headers)) return null;
  const wanted = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === wanted && typeof value === 'string') return value;
  }
  return null;
}

/**
 * The summary the server answered, or a load error: a body that is not the summary (the page of another kind an odd proxy sends, a server older than this page) is never drawn, because a
 * missing list would show up as «nothing this month» and a missing block would crash the page. Only the shape the screen walks is checked; the figures are the server's.
 */
function asAgencySummary(data: unknown): AgencySummary {
  const summary = isRecord(data) ? data : null;
  const lists = ['guestDocuments', 'portalCosts', 'commissions', 'payouts', 'wires', 'portalCommissionsBorne', 'margin', 'owners'] as const;
  const blocks = ['stays', 'collections', 'touristTax', 'ownerInvoices'] as const;
  if (
    !summary ||
    typeof summary.period !== 'string' ||
    typeof summary.periodKind !== 'string' ||
    typeof summary.from !== 'string' ||
    typeof summary.to !== 'string' ||
    typeof summary.generatedOn !== 'string' ||
    typeof summary.ownerAccountingIncluded !== 'boolean' ||
    lists.some((key) => !Array.isArray(summary[key])) ||
    blocks.some((key) => !isRecord(summary[key]))
  ) {
    throw new UnexpectedApiResponseError(`${PATH}/agency-summary`);
  }
  const { collections, touristTax, ownerInvoices } = summary as { collections: Record<string, unknown>; touristTax: Record<string, unknown>; ownerInvoices: Record<string, unknown> };
  if (
    !Array.isArray(collections.toCollect) ||
    !Array.isArray(touristTax.switzerland) ||
    !isRecord(touristTax.italy) ||
    !Array.isArray(ownerInvoices.counts) ||
    !Array.isArray(ownerInvoices.rates)
  ) {
    throw new UnexpectedApiResponseError(`${PATH}/agency-summary`);
  }
  return data as AgencySummary;
}

/**
 * What the 422 `accountant_package_too_large` says (a JSON body that `withJsonErrorBody` has parsed), or `null` for any other error: how many files the package would hold and how many one
 * archive allows. With a number missing the page cannot tell by how much the period went over and says only that the package would be too large (both are `null`).
 */
export function accountantPackageTooLarge(error: unknown): { fileCount: number | null; maxFiles: number | null } | null {
  if (!isAxiosError(error) || error.response?.status !== 422 || getProblemCode(error.response.data) !== TOO_LARGE_CODE) return null;
  const body = error.response.data as Record<string, unknown>;
  const wholeNumber = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : null);
  const fileCount = wholeNumber(body.fileCount);
  const maxFiles = wholeNumber(body.maxFiles);
  return fileCount === null || maxFiles === null ? { fileCount: null, maxFiles: null } : { fileCount, maxFiles };
}

/**
 * The package of the accountant and the summary of the agency (E15/F02/US01/T01, NF-101, NF-115; backend `api/accountant-package`). Paths are relative to the API base URL, which already ends
 * in `/api`. Both calls need `payment.read` and answer 404 while the flag `AccountantPackage` is off; the owner accounting is part of the answer only for a caller who may read it, which the
 * server decides. Nothing here writes: the package is built on request and never stored.
 */
export const accountantPackageApi = {
  /**
   * The summary of a month (`2026-10`) or a year (`2026`). `null` when the server refuses it to this caller (403): a refused read would send the whole app to the page of no access, and
   * the page only has to say that the access is not there.
   */
  getAgencySummary: async (period: string): Promise<AgencySummary | null> => {
    const response = await axios.get<unknown>(`${PATH}/agency-summary`, { params: { period }, validateStatus: acceptsRefusal });
    if (response.status === 403) return null;
    return asAgencySummary(response.data);
  },

  /**
   * The ZIP of a month or a year, through the authenticated client (never from an address the browser would open without the token), with the name the server gave it (`Content-Disposition`,
   * `null` when the page cannot read it). The call can be stopped (`signal`) and tells how many bytes came so far (`onProgress`: the server does not know the size beforehand); the server
   * refuses a package that is too large before the first byte (422, see {@link accountantPackageTooLarge}) and a 403 is a `ReportAccessDeniedError`, an answer of the call and not a trip to
   * the page of no access. A problem body (a JSON Blob) is parsed so that its code can be read.
   */
  download: async (period: string, options: { signal?: AbortSignal; onProgress?: (bytes: number) => void } = {}): Promise<DownloadedFile> => {
    try {
      const response = await axios.get<Blob>(PATH, {
        params: { period },
        responseType: 'blob',
        timeout: DOWNLOAD_TIMEOUT_MS,
        signal: options.signal,
        onDownloadProgress: (event) => options.onProgress?.(event.loaded),
        validateStatus: acceptsRefusal,
      });
      if (response.status === 403) throw new ReportAccessDeniedError(PATH);
      if (!(response.data instanceof Blob) || NOT_A_FILE.test(response.data.type)) throw new UnexpectedApiResponseError(PATH);
      return { blob: response.data, contentDisposition: headerOf(response.headers, 'content-disposition') };
    } catch (error) {
      throw await withJsonErrorBody(error);
    }
  },
};
