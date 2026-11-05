import axios from '@/lib/axios';
import { UnexpectedApiResponseError } from '@/lib/api-errors';
import { withJsonErrorBody } from '@/lib/file-download';
import type { PerformanceGroupBy, PerformanceReport, TrendReport } from '@/types/report.types';

/** The reads of short rent under `GET /api/reports/*` (SR-10): ricavo, occupazione e canali. */
export type HostReportKind = 'revenue-by-property' | 'occupancy-by-property' | 'bookings-by-channel';

/** Report period: calendar dates `YYYY-MM-DD` in Europe/Rome, both included, at most 24 months. */
export interface ReportPeriod {
  from: string;
  to: string;
}

/** The size of the buckets of a trend: `auto` is the server's choice, weeks up to 92 days and months beyond. */
export type TrendBucketSize = 'auto' | 'week' | 'month';

/**
 * What the overview asks `GET /api/reports/performance` and `GET /api/reports/trend` (NF-96): the days, one property or the whole
 * scope, how the figures are cut and whether the same days one year earlier come with them.
 */
export interface PerformanceQuery extends ReportPeriod {
  propertyId?: string;
  groupBy: PerformanceGroupBy;
  /** `compare=previousYear`: every figure comes with the same calendar days one year earlier and the differences, worked out by the server. */
  compare: boolean;
  /** Only for the trend. */
  bucket?: TrendBucketSize;
}

/** Start of the file name of each report: the words of the file the backend sends (the base is in it where it has one). */
const FILE_NAMES: Record<HostReportKind, string> = {
  'revenue-by-property': 'casazen-ricavo-per-immobile-competenza',
  'occupancy-by-property': 'casazen-occupazione-per-immobile',
  'bookings-by-channel': 'casazen-prenotazioni-per-canale-competenza',
};

/** Name of the downloaded file: the report and its days (`casazen-ricavo-per-immobile-competenza-2026-10-01-2026-10-31.csv`). */
export function hostReportFileName(kind: HostReportKind, period: ReportPeriod): string {
  return `${FILE_NAMES[kind]}-${period.from}-${period.to}.csv`;
}

const PERFORMANCE_PATH = '/reports/performance';
const TREND_PATH = '/reports/trend';

/** The query string of the performance report and of the trend; the bucket only where the read has one. */
function performanceParams(query: PerformanceQuery, withBucket: boolean): Record<string, string> {
  const params: Record<string, string> = {
    from: query.from,
    to: query.to,
    groupBy: query.groupBy,
    compare: query.compare ? 'previousYear' : 'none',
  };
  if (query.propertyId) params.propertyId = query.propertyId;
  if (withBucket && query.bucket) params.bucket = query.bucket;
  return params;
}

/** A read that did not come back as an object (the page of another kind an odd proxy sends) is an error to show, not data to draw. */
function asReport<T>(url: string, data: unknown): T {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) throw new UnexpectedApiResponseError(url);
  return data as T;
}

export const reportsApi = {
  /** The CSV of a report (`;`, decimal comma, BOM); a problem body (JSON Blob) is parsed so `getProblemMessage` can read it. */
  downloadCsv: async (kind: HostReportKind, period: ReportPeriod): Promise<Blob> => {
    try {
      const res = await axios.get<Blob>(`/reports/${kind}`, {
        params: { ...period, format: 'csv' },
        responseType: 'blob',
      });
      return res.data;
    } catch (error) {
      throw await withJsonErrorBody(error);
    }
  },

  /** Occupancy, revenue, ADR and RevPAR of the Home for a period, with the same days one year earlier when asked (NF-96). */
  getPerformance: async (query: PerformanceQuery): Promise<PerformanceReport> => {
    const res = await axios.get<unknown>(PERFORMANCE_PATH, { params: performanceParams(query, false) });
    return asReport<PerformanceReport>(PERFORMANCE_PATH, res.data);
  },

  /** The same figures week by week or month by month, each bucket next to its days one year earlier when asked (NF-96). */
  getTrend: async (query: PerformanceQuery): Promise<TrendReport> => {
    const res = await axios.get<unknown>(TREND_PATH, { params: performanceParams(query, true) });
    return asReport<TrendReport>(TREND_PATH, res.data);
  },
};
