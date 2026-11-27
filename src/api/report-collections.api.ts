import axios from '@/lib/axios';
import { UnexpectedApiResponseError } from '@/lib/api-errors';
import type { BalancesToCollectReport, CollectionsReport } from '@/types';
import { ACCEPT_FORBIDDEN, asReportObject, compactDay, downloadReportFile, reportQuery } from './report-files';
import type { ReportPeriod } from './reports.api';

const COLLECTIONS_PATH = '/reports/collections';
const BALANCES_PATH = '/reports/balances-to-collect';

/**
 * Name of the downloaded file: the report and its days, written the way the server names it
 * (`casazen-incassato-per-cassa-20261001-20261031.csv`). Never a property, a guest or an owner.
 */
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

/**
 * The collections report (NF-97, REP-02): the money that came in by date, by payment method and by channel, what is still to collect and
 * what reached the account. Every figure is the server's; the caller needs `payment.read` and sees only what its scope reaches.
 *
 * The reads resolve to `null` on a 403 ("not for this caller"): a 403 on a read would make the shared axios client send the whole app
 * to the no-access page, and the page only has to say that the report is not open to the person.
 */
export const reportCollectionsApi = {
  /** The money collected between two days (at most 24 months), cut three ways, with the credits; one property when `propertyId` is not empty. */
  getCollections: async (period: ReportPeriod, propertyId: string): Promise<CollectionsReport | null> => {
    const res = await axios.get<unknown>(COLLECTIONS_PATH, { params: reportQuery(period, propertyId), validateStatus: ACCEPT_FORBIDDEN });
    return res.status === 403 ? null : asCollections(res.data);
  },

  /** The stays that still have something to collect, as of today (no period); one property when `propertyId` is not empty. */
  getBalancesToCollect: async (propertyId: string): Promise<BalancesToCollectReport | null> => {
    const res = await axios.get<unknown>(BALANCES_PATH, {
      params: propertyId ? { propertyId } : {},
      validateStatus: ACCEPT_FORBIDDEN,
    });
    return res.status === 403 ? null : asBalances(res.data);
  },

  /** The collections as a CSV (`;`, decimal comma, BOM): the three cuts one under the other. */
  downloadCsv: (period: ReportPeriod, propertyId: string): Promise<Blob> => downloadReportFile(COLLECTIONS_PATH, reportQuery(period, propertyId), 'csv'),

  /** The collections as an Excel file: one sheet for each cut, numbers as numbers (the client builds no formula, it only saves the file). */
  downloadXlsx: (period: ReportPeriod, propertyId: string): Promise<Blob> => downloadReportFile(COLLECTIONS_PATH, reportQuery(period, propertyId), 'xlsx'),
};
