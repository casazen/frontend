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

export type YearEndAccountCut = 'month' | 'quarter';

const MULTIPART_UPLOAD = {
  headers: { 'Content-Type': 'multipart/form-data' },
  timeout: 120_000,
};

export function touristTaxSummaryCsvFileName(period: ReportPeriod): string {
  return `casazen-tassa-soggiorno-riepilogo-${period.from.replaceAll('-', '')}-${period.to.replaceAll('-', '')}.csv`;
}

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

export const touristTaxSummaryApi = {
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

  downloadYearEndAgentAccount: (year: number, by: YearEndAccountCut, format: ReportFileFormat): Promise<DownloadedFile> =>
    getTaxFile(`${YEAR_END_PATH}/${year}/agent-account`, { by, format }),

  downloadYearEndTicinoCount: (year: number, format: ReportFileFormat): Promise<DownloadedFile> => getTaxFile(`${YEAR_END_PATH}/${year}/ticino`, { format }),

  /**
   * The annual declaration of the year per comune as the data itself, for the screen (`?format=json`: the very data of the files, nothing recomputed). The exemptions are by reason only for a caller that holds
   * `guest.read` on the whole organization (art. 9 GDPR); for everybody else the server gives the age and one restricted row, and the page shows what it gives. A 403 is a `ReportAccessDeniedError`.
   */
  getYearEndDeclaration: (year: number): Promise<TouristTaxDeclaration> => getYearEndJson(`${YEAR_END_PATH}/${year}/declaration`, {}, asDeclaration),

  getYearEndAgentAccount: (year: number, by: YearEndAccountCut): Promise<TouristTaxAgentAccount> => getYearEndJson(`${YEAR_END_PATH}/${year}/agent-account`, { by }, asAgentAccount),

  getYearEndTicinoCount: (year: number): Promise<TicinoYearlyCount> => getYearEndJson(`${YEAR_END_PATH}/${year}/ticino`, {}, asTicinoCount),

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

  recordRemittance: (input: RecordTouristTaxRemittanceInput) =>
    ApiClient.post<TouristTaxRemittance>(REMITTANCES_PATH, remittanceForm(input), MULTIPART_UPLOAD),

  downloadReceipt: async (id: string): Promise<Blob> => {
    try {
      const res = await axios.get<Blob>(`${REMITTANCES_PATH}/${encodeURIComponent(id)}/receipt`, { responseType: 'blob' });
      return res.data;
    } catch (error) {
      throw await withJsonErrorBody(error);
    }
  },

  deleteRemittance: (id: string) => ApiClient.delete<void>(`${REMITTANCES_PATH}/${encodeURIComponent(id)}`),
};
