import axios from '@/lib/axios';
import { UnexpectedApiResponseError } from '@/lib/api-errors';
import type { BalancesToCollectReport, CollectionsReport } from '@/types';
import { ACCEPT_FORBIDDEN, asReportObject, compactDay, downloadReportFile, reportQuery } from './report-files';
import type { ReportPeriod } from './reports.api';

const COLLECTIONS_PATH = '/reports/collections';
const BALANCES_PATH = '/reports/balances-to-collect';

export function collectionsFileName(period: ReportPeriod, format: 'csv' | 'xlsx'): string {
  return `casazen-incassato-per-cassa-${compactDay(period.from)}-${compactDay(period.to)}.${format}`;
}

function asCollections(data: unknown): CollectionsReport {
  const report = asReportObject(COLLECTIONS_PATH, data);
  const credits = report.credits as Record<string, unknown> | null | undefined;
  if (
    typeof report.total !== 'object' ||
    report.total === null ||
    !Array.isArray(report.byDate) ||
    !Array.isArray(report.byMethod) ||
    !Array.isArray(report.byChannel) ||
    typeof credits !== 'object' ||
    credits === null ||
    typeof credits.stripe !== 'object' ||
    credits.stripe === null ||
    typeof credits.channels !== 'object' ||
    credits.channels === null
  ) {
    throw new UnexpectedApiResponseError(COLLECTIONS_PATH);
  }
  return data as CollectionsReport;
}

function asBalances(data: unknown): BalancesToCollectReport {
  const report = asReportObject(BALANCES_PATH, data);
  if (!Array.isArray(report.rows) || !Array.isArray(report.totals)) throw new UnexpectedApiResponseError(BALANCES_PATH);
  return data as BalancesToCollectReport;
}

export const reportCollectionsApi = {
  getCollections: async (period: ReportPeriod, propertyId: string): Promise<CollectionsReport | null> => {
    const res = await axios.get<unknown>(COLLECTIONS_PATH, { params: reportQuery(period, propertyId), validateStatus: ACCEPT_FORBIDDEN });
    return res.status === 403 ? null : asCollections(res.data);
  },

  getBalancesToCollect: async (propertyId: string): Promise<BalancesToCollectReport | null> => {
    const res = await axios.get<unknown>(BALANCES_PATH, {
      params: propertyId ? { propertyId } : {},
      validateStatus: ACCEPT_FORBIDDEN,
    });
    return res.status === 403 ? null : asBalances(res.data);
  },

  downloadCsv: (period: ReportPeriod, propertyId: string): Promise<Blob> => downloadReportFile(COLLECTIONS_PATH, reportQuery(period, propertyId), 'csv'),

  downloadXlsx: (period: ReportPeriod, propertyId: string): Promise<Blob> => downloadReportFile(COLLECTIONS_PATH, reportQuery(period, propertyId), 'xlsx'),
};
