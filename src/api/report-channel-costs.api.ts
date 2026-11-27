import axios from '@/lib/axios';
import { UnexpectedApiResponseError } from '@/lib/api-errors';
import type { ChannelCostsReport } from '@/types';
import { ACCEPT_FORBIDDEN, asReportObject, compactDay, downloadReportFile, reportQuery } from './report-files';
import type { ReportPeriod } from './reports.api';

const CHANNEL_COSTS_PATH = '/reports/channel-costs';

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

export const reportChannelCostsApi = {
  getChannelCosts: async (period: ReportPeriod, propertyId: string): Promise<ChannelCostsReport | null> => {
    const res = await axios.get<unknown>(CHANNEL_COSTS_PATH, { params: reportQuery(period, propertyId), validateStatus: ACCEPT_FORBIDDEN });
    return res.status === 403 ? null : asChannelCosts(res.data);
  },

  downloadCsv: (period: ReportPeriod, propertyId: string): Promise<Blob> => downloadReportFile(CHANNEL_COSTS_PATH, reportQuery(period, propertyId), 'csv'),

  downloadXlsx: (period: ReportPeriod, propertyId: string): Promise<Blob> => downloadReportFile(CHANNEL_COSTS_PATH, reportQuery(period, propertyId), 'xlsx'),
};
