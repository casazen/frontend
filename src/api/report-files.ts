import axios from '@/lib/axios';
import { UnexpectedApiResponseError } from '@/lib/api-errors';
import { withJsonErrorBody } from '@/lib/file-download';
import type { ReportPeriod } from './reports.api';

/** The days of a file name as the server writes them (`20261001`). */
export function compactDay(day: string): string {
  return day.replaceAll('-', '');
}

/** The query of the money reports: the days (`yyyy-MM-dd`, Europe/Rome) and, when the person narrows it, one property. */
export function reportQuery(period: ReportPeriod, propertyId: string): Record<string, string> {
  return { from: period.from, to: period.to, ...(propertyId ? { propertyId } : {}) };
}

/** The two files a money report can be downloaded as (NF-101): the CSV for a spreadsheet set to Italian, and the Excel file the accountant opens. */
export type ReportFileFormat = 'csv' | 'xlsx';

/**
 * The server said 403 to a read or a download of a report: it is not for this caller (no `payment.read`, or no organization). It is an
 * answer, not a failure of the network: a page tells the person so where they are, instead of the whole app going to the page of the
 * missing access.
 */
export class ReportAccessDeniedError extends Error {
  constructor(url: string) {
    super(`Report not available to this caller (${url})`);
    this.name = 'ReportAccessDeniedError';
  }
}

/**
 * Accepts the 403 as an answer of the call. A 403 on a read makes the shared axios client send the whole app to the no-access page; the
 * report pages show a state of their own instead (the same choice `reportsApi.getByOwner` makes).
 */
export const ACCEPT_FORBIDDEN = (status: number): boolean => (status >= 200 && status < 300) || status === 403;

/** A report answer that is not an object is the page of another kind an odd proxy sends: an error to show, not data to draw. */
export function asReportObject(url: string, data: unknown): Record<string, unknown> {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) throw new UnexpectedApiResponseError(url);
  return data as Record<string, unknown>;
}

/** A file answer that says it is a web page or a JSON body is not the file that was asked for. */
const NOT_A_FILE = /^(text\/html|application\/(json|problem\+json))/i;

/**
 * A report as a file, from the authenticated API (never from an address the browser would open without the token). The answer is a Blob
 * the caller saves and lets go of: nothing here keeps it. A problem body (a JSON Blob) is parsed so `getProblemMessage` can read its code
 * (`xlsx_too_many_rows`, `report_period_too_long`); a 403 is a `ReportAccessDeniedError`.
 */
export async function downloadReportFile(path: string, params: Record<string, string>, format: ReportFileFormat): Promise<Blob> {
  try {
    const res = await axios.get<Blob>(path, {
      params: { ...params, format },
      responseType: 'blob',
      validateStatus: ACCEPT_FORBIDDEN,
    });
    if (res.status === 403) throw new ReportAccessDeniedError(path);
    if (!(res.data instanceof Blob) || NOT_A_FILE.test(res.data.type)) throw new UnexpectedApiResponseError(path);
    return res.data;
  } catch (error) {
    throw await withJsonErrorBody(error);
  }
}
