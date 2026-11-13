import axios from '@/lib/axios';
import { UnexpectedApiResponseError } from '@/lib/api-errors';
import type { ChannelCostsReport } from '@/types';
import { ACCEPT_FORBIDDEN, asReportObject, compactDay, downloadReportFile, reportQuery } from './report-files';
import type { ReportPeriod } from './reports.api';

const CHANNEL_COSTS_PATH = '/reports/channel-costs';

/**
 * Name of the downloaded file: the report and its days, written the way the server names it
 * (`casazen-costi-dei-canali-competenza-20261001-20261031.csv`). Never a property, a guest or an owner.
 */
export function channelCostsFileName(period: ReportPeriod, format: 'csv' | 'xlsx'): string {
  return `casazen-costi-dei-canali-competenza-${compactDay(period.from)}-${compactDay(period.to)}.${format}`;
}

function asChannelCosts(data: unknown): ChannelCostsReport {
  const report = asReportObject(CHANNEL_COSTS_PATH, data);
  if (!Array.isArray(report.rows) || typeof report.total !== 'object' || report.total === null) {
    throw new UnexpectedApiResponseError(CHANNEL_COSTS_PATH);
  }
  return data as ChannelCostsReport;
}

/**
 * The channel costs report (NF-98, REP-03): gross, commission and net of each channel, the card fees of the direct stays and how each
 * channel settles its commission. Every figure is the server's; the caller needs `payment.read` and sees only what its scope reaches.
 *
 * The read resolves to `null` on a 403 ("not for this caller"): a 403 on a read would make the shared axios client send the whole app to
 * the no-access page, and the page only has to say that the report is not open to the person.
 */
export const reportChannelCostsApi = {
  /** What each channel costs between two days (at most 24 months); one property when `propertyId` is not empty. */
  getChannelCosts: async (period: ReportPeriod, propertyId: string): Promise<ChannelCostsReport | null> => {
    const res = await axios.get<unknown>(CHANNEL_COSTS_PATH, { params: reportQuery(period, propertyId), validateStatus: ACCEPT_FORBIDDEN });
    return res.status === 403 ? null : asChannelCosts(res.data);
  },

  /** The report as a CSV (`;`, decimal comma, BOM). */
  downloadCsv: (period: ReportPeriod, propertyId: string): Promise<Blob> => downloadReportFile(CHANNEL_COSTS_PATH, reportQuery(period, propertyId), 'csv'),

  /** The report as an Excel file: numbers as numbers (the client builds no formula, it only saves the file). */
  downloadXlsx: (period: ReportPeriod, propertyId: string): Promise<Blob> => downloadReportFile(CHANNEL_COSTS_PATH, reportQuery(period, propertyId), 'xlsx'),
};
