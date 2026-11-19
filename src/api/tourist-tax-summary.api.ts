import axios from '@/lib/axios';
import { UnexpectedApiResponseError } from '@/lib/api-errors';
import { withJsonErrorBody } from '@/lib/file-download';
import type {
  RecordTouristTaxRemittanceInput,
  TicinoYearlyCount,
  TouristTaxAgentAccount,
  TouristTaxDeclaration,
  TouristTaxRemittance,
  TouristTaxSummary,
} from '@/types';
import { acceptsRefusal } from './accept-refusal';
import { ApiClient } from './client';
import type { DownloadedFile } from './file.api';
import type { ReportPeriod } from './reports.api';
import { asReportObject, ReportAccessDeniedError, type ReportFileFormat } from './report-files';
import { getTaxFile } from './tax-file';

const SUMMARY_PATH = '/tourist-tax/summary';
const REMITTANCES_PATH = '/tourist-tax/remittances';
const YEAR_END_PATH = '/tourist-tax/year-end';

/** How the account of the agent is cut (backend `by`): twelve months or four quarters. */
export type YearEndAccountCut = 'month' | 'quarter';

/** Explicit multipart: the client's default JSON content type would serialize the FormData as JSON. */
const MULTIPART_UPLOAD = {
  headers: { 'Content-Type': 'multipart/form-data' },
  // A receipt is up to 10 MB: more than the 30 s of every other call, on a connection that is not fast.
  timeout: 120_000,
};

/**
 * Name of the downloaded CSV: the summary and its days, written the way the server names the file
 * (`casazen-tassa-soggiorno-riepilogo-20260101-20261231.csv`).
 */
export function touristTaxSummaryCsvFileName(period: ReportPeriod): string {
  return `casazen-tassa-soggiorno-riepilogo-${period.from.replaceAll('-', '')}-${period.to.replaceAll('-', '')}.csv`;
}

/** A read that did not come back as the summary (the page of another kind an odd proxy sends) is an error to show, not data to draw. */
function asSummary(data: unknown): TouristTaxSummary {
  const summary = data as Partial<TouristTaxSummary> | null;
  if (typeof data !== 'object' || summary === null || !Array.isArray(summary.comuni) || typeof summary.total !== 'object' || summary.total === null) {
    throw new UnexpectedApiResponseError(SUMMARY_PATH);
  }
  return data as TouristTaxSummary;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** A year-end answer that is not the typed object (the page of another kind an odd proxy sends, an answer with a part missing) is an error to show, not data to draw: the page reads every part it draws. */
function asDeclaration(path: string, data: unknown): TouristTaxDeclaration {
  const body = asReportObject(path, data);
  const sound =
    isRecord(body.total) &&
    Array.isArray(body.comuni) &&
    body.comuni.every((comune) => isRecord(comune) && isRecord(comune.summary) && Array.isArray(comune.staysWithoutAmount) && Array.isArray(comune.exemptions));
  if (!sound) throw new UnexpectedApiResponseError(path);
  return body as unknown as TouristTaxDeclaration;
}

function asAgentAccount(path: string, data: unknown): TouristTaxAgentAccount {
  const body = asReportObject(path, data);
  const sound = isRecord(body.total) && Array.isArray(body.rows) && body.rows.every(isRecord) && Array.isArray(body.remittances) && body.remittances.every(isRecord);
  if (!sound) throw new UnexpectedApiResponseError(path);
  return body as unknown as TouristTaxAgentAccount;
}

function asTicinoCount(path: string, data: unknown): TicinoYearlyCount {
  const body = asReportObject(path, data);
  const sound = Array.isArray(body.properties) && body.properties.every(isRecord) && typeof body.cantonUnknownCount === 'number';
  if (!sound) throw new UnexpectedApiResponseError(path);
  return body as unknown as TicinoYearlyCount;
}

/**
 * A year-end result as JSON: the format is always named (`format=json`), because the server refuses a request that names none. The 403 is an answer of the call and not a failure of the app: the shared client sends the whole
 * app to the page of no access on a 403 for a read, so it is accepted here and thrown again as a `ReportAccessDeniedError`, which the page tells under its section. A 400 `report_invalid_format` (the server has no JSON of
 * them yet) and every other failure stay the errors of the call.
 */
async function getYearEndJson<T>(path: string, params: Record<string, string>, parse: (path: string, data: unknown) => T): Promise<T> {
  const res = await axios.get<unknown>(path, { params: { ...params, format: 'json' }, validateStatus: acceptsRefusal });
  if (res.status === 403) throw new ReportAccessDeniedError(path);
  return parse(path, res.data);
}

/**
 * The form of a payment, field by field as the API reads it. The amount goes as the text the host's input was turned into (`12.50`),
 * never as a number; what the host left empty (reference, note, receipt) is not sent at all.
 */
function remittanceForm(input: RecordTouristTaxRemittanceInput): FormData {
  const form = new FormData();
  form.append('comune', input.comune);
  form.append('periodFrom', input.periodFrom);
  form.append('periodTo', input.periodTo);
  form.append('paidAmount', input.paidAmount);
  form.append('paidOn', input.paidOn);
  if (input.reference) form.append('reference', input.reference);
  if (input.notes) form.append('notes', input.notes);
  if (input.receipt) form.append('receipt', input.receipt);
  return form;
}

/** The tourist tax per comune (NF-100, REP-05): what the stays owe, what the host paid and the receipts. */
export const touristTaxSummaryApi = {
  /** The summary of the days (at most a year): owed, paid and balance per comune, as the server works them out. */
  getSummary: async (period: ReportPeriod): Promise<TouristTaxSummary> => {
    const res = await axios.get<unknown>(SUMMARY_PATH, { params: { from: period.from, to: period.to } });
    return asSummary(res.data);
  },

  /**
   * The summary of a whole calendar year, the figures the year-end declaration is made of (the server builds both from the same read, and the page works out nothing). `null` when the server refuses it to this
   * caller (403): the page tells it in words, because a 403 on a read would send the whole app to the page of no access.
   */
  getYear: async (year: number): Promise<TouristTaxSummary | null> => {
    const res = await axios.get<unknown>(SUMMARY_PATH, { params: { from: `${year}-01-01`, to: `${year}-12-31` }, validateStatus: acceptsRefusal });
    return res.status === 403 ? null : asSummary(res.data);
  },

  /**
   * The annual declaration data of the year per comune as a CSV or an Excel file (E18/F01/US02/T03, behind `taxReportingExports`, `payment.read`, the whole organization: 403 otherwise): nights and guests, the stays
   * with and without a tax, the exempt guests by reason (the reasons only for who holds `guest.read`: the others get the age and one restricted row), the tax due, the tax remitted and the difference. The page never
   * reads the file: the server neutralizes the cells that a spreadsheet would run as formulas, the bytes go to the disk as they came. The same data for a screen is `getYearEndDeclaration`.
   */
  downloadYearEndDeclaration: (year: number, format: ReportFileFormat): Promise<DownloadedFile> => getTaxFile(`${YEAR_END_PATH}/${year}/declaration`, { format }),

  /** The account of the agent of the year as a CSV or an Excel file: for each comune the tax collected and remitted by month or by quarter, the line of the year and every payment. Same gate and reach as the declaration. */
  downloadYearEndAgentAccount: (year: number, by: YearEndAccountCut, format: ReportFileFormat): Promise<DownloadedFile> =>
    getTaxFile(`${YEAR_END_PATH}/${year}/agent-account`, { by, format }),

  /**
   * The yearly count of the nights of the properties in Ticino as a CSV or an Excel file, due by 5 January of the next year: stays and nights of the year, taxed and untaxed by the documents issued, and the francs of
   * the documents. A property in Switzerland whose canton is not known is in it with a note in the last column. Same gate and reach as the declaration.
   */
  downloadYearEndTicinoCount: (year: number, format: ReportFileFormat): Promise<DownloadedFile> => getTaxFile(`${YEAR_END_PATH}/${year}/ticino`, { format }),

  /**
   * The annual declaration of the year per comune as the data itself, for the screen (`?format=json`: the very data of the files, nothing recomputed). The exemptions are by reason only for a caller that holds
   * `guest.read` on the whole organization (art. 9 GDPR); for everybody else the server gives the age and one restricted row, and the page shows what it gives. A 403 is a `ReportAccessDeniedError`.
   */
  getYearEndDeclaration: (year: number): Promise<TouristTaxDeclaration> => getYearEndJson(`${YEAR_END_PATH}/${year}/declaration`, {}, asDeclaration),

  /** The account of the agent of the year as the data itself: for each comune the tax collected and remitted by month or by quarter, the line of the year and every payment. Same gate, reach and refusals as the declaration. */
  getYearEndAgentAccount: (year: number, by: YearEndAccountCut): Promise<TouristTaxAgentAccount> => getYearEndJson(`${YEAR_END_PATH}/${year}/agent-account`, { by }, asAgentAccount),

  /**
   * The yearly count of the nights of the properties in Ticino as the data itself, with its due date and `cantonUnknownCount`, the number of the properties in Switzerland whose canton is not known (flagged on their
   * row, never left out). Same gate, reach and refusals as the declaration.
   */
  getYearEndTicinoCount: (year: number): Promise<TicinoYearlyCount> => getYearEndJson(`${YEAR_END_PATH}/${year}/ticino`, {}, asTicinoCount),

  /** The same summary as a CSV; a problem body (JSON Blob) is parsed so `getProblemMessage` can read it. */
  downloadCsv: async (period: ReportPeriod): Promise<Blob> => {
    try {
      const res = await axios.get<Blob>(SUMMARY_PATH, {
        params: { from: period.from, to: period.to, format: 'csv' },
        responseType: 'blob',
      });
      return res.data;
    } catch (error) {
      throw await withJsonErrorBody(error);
    }
  },

  /** Records a payment, with its receipt when one is sent (`multipart/form-data`). */
  recordRemittance: (input: RecordTouristTaxRemittanceInput) =>
    ApiClient.post<TouristTaxRemittance>(REMITTANCES_PATH, remittanceForm(input), MULTIPART_UPLOAD),

  /** The receipt of a payment, from the private bucket of the server. */
  downloadReceipt: async (id: string): Promise<Blob> => {
    try {
      const res = await axios.get<Blob>(`${REMITTANCES_PATH}/${encodeURIComponent(id)}/receipt`, { responseType: 'blob' });
      return res.data;
    } catch (error) {
      throw await withJsonErrorBody(error);
    }
  },

  /** Deletes a wrong entry: the payment and its receipt. */
  deleteRemittance: (id: string) => ApiClient.delete<void>(`${REMITTANCES_PATH}/${encodeURIComponent(id)}`),
};
