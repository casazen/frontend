import axios from '@/lib/axios';
import { UnexpectedApiResponseError } from '@/lib/api-errors';
import { withJsonErrorBody } from '@/lib/file-download';
import type { RecordTouristTaxRemittanceInput, TouristTaxRemittance, TouristTaxSummary } from '@/types';
import { ApiClient } from './client';
import type { ReportPeriod } from './reports.api';

const SUMMARY_PATH = '/tourist-tax/summary';
const REMITTANCES_PATH = '/tourist-tax/remittances';

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
