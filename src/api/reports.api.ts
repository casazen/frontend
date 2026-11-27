import axios from '@/lib/axios';
import { withJsonErrorBody } from '@/lib/file-download';
import type { OwnerReport, PerformanceGroupBy, PerformanceReport, TrendReport } from '@/types/report.types';
import { asReport } from '@/api/response-helpers';

export type HostReportKind = 'revenue-by-property' | 'occupancy-by-property' | 'bookings-by-channel';

export interface ReportPeriod {
  from: string;
  to: string;
}

export type TrendBucketSize = 'auto' | 'week' | 'month';

export interface PerformanceQuery extends ReportPeriod {
  propertyId?: string;
  groupBy: PerformanceGroupBy;
  compare: boolean;
  bucket?: TrendBucketSize;
}

const FILE_NAMES: Record<HostReportKind, string> = {
  'revenue-by-property': 'casazen-ricavo-per-immobile-competenza',
  'occupancy-by-property': 'casazen-occupazione-per-immobile',
  'bookings-by-channel': 'casazen-prenotazioni-per-canale-competenza',
};

export function hostReportFileName(kind: HostReportKind, period: ReportPeriod): string {
  return `${FILE_NAMES[kind]}-${period.from}-${period.to}.csv`;
}

const PERFORMANCE_PATH = '/reports/performance';
const TREND_PATH = '/reports/trend';
const BY_OWNER_PATH = '/reports/by-owner';

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

export const reportsApi = {
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

  getPerformance: async (query: PerformanceQuery): Promise<PerformanceReport> => {
    const res = await axios.get<unknown>(PERFORMANCE_PATH, { params: performanceParams(query, false) });
    return asReport<PerformanceReport>(PERFORMANCE_PATH, res.data);
  },

  getTrend: async (query: PerformanceQuery): Promise<TrendReport> => {
    const res = await axios.get<unknown>(TREND_PATH, { params: performanceParams(query, true) });
    return asReport<TrendReport>(TREND_PATH, res.data);
  },

  /**
   * The figures of an agency cut by property owner (NF-96): one row for each owner, the properties nobody owns and the total, as the
   * server sends them. The view is for the owner and the administrators of an agency, so a 403 is an answer here, not a failure:
   * it resolves to `null` ("not for this caller") instead of throwing, because a 403 on a read would make the shared axios client
   * send the whole app to the no-access page, and the page only has to leave the grouping out.
   */
  getByOwner: async (period: ReportPeriod): Promise<OwnerReport | null> => {
    const res = await axios.get<unknown>(BY_OWNER_PATH, {
      params: { from: period.from, to: period.to },
      validateStatus: (status) => (status >= 200 && status < 300) || status === 403,
    });
    return res.status === 403 ? null : asReport<OwnerReport>(BY_OWNER_PATH, res.data);
  },
};
