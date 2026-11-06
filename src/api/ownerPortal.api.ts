import { UnexpectedApiResponseError } from '@/lib/api-errors';
import { ApiClient } from './client';
import type {
  OwnerPortalProperty,
  OwnerPortalStatement,
  OwnerPortalInvoice,
  OwnerPortalOverview,
  OwnerPortalReportQuery,
  OwnerPortalTrend,
  OwnerPortalWithholding,
} from '@/types';

const OVERVIEW_PATH = '/owner-portal/overview';
const TREND_PATH = '/owner-portal/trend';

/** The query string of the overview and of the trend: the days, the cut and whether the year before comes with them. */
function reportParams(query: OwnerPortalReportQuery): Record<string, string> {
  const params: Record<string, string> = {
    from: query.from,
    to: query.to,
    groupBy: query.groupBy,
    compare: query.compare ? 'previousYear' : 'none',
  };
  if (query.propertyId) params.propertyId = query.propertyId;
  return params;
}

/** A read that did not come back as an object (the page of another kind an odd proxy sends) is an error to show, not data to draw. */
function asReport<T>(url: string, data: unknown): T {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) throw new UnexpectedApiResponseError(url);
  return data as T;
}

export const ownerPortalApi = {
  /**
   * List properties with occupancy and revenue (ADR-011-R8).
   * Filtered by PropertyOwnership.OwnerUserId AND period active.
   */
  getProperties: () =>
    ApiClient.get<OwnerPortalProperty[]>('/owner-portal/properties'),

  /**
   * The owner's properties on the Home's numbers (NF-96): occupancy, revenue, ADR and RevPAR of the days, with the same days one
   * year earlier and the differences when asked. Money is weighted by the share the owner holds; every number is the server's.
   */
  getOverview: async (query: OwnerPortalReportQuery) =>
    asReport<OwnerPortalOverview>(OVERVIEW_PATH, await ApiClient.get<unknown>(OVERVIEW_PATH, reportParams(query))),

  /** The same figures week by week or month by month, each bucket next to its days one year earlier when asked (NF-96). */
  getTrend: async (query: OwnerPortalReportQuery) =>
    asReport<OwnerPortalTrend>(TREND_PATH, await ApiClient.get<unknown>(TREND_PATH, reportParams(query))),

  /**
   * Get published statements for the owner (ADR-011-R2).
   * Only published statements are visible.
   */
  getStatements: (params?: { year?: number; propertyId?: string }) =>
    ApiClient.get<OwnerPortalStatement[]>('/owner-portal/statements', params),

  /**
   * Get invoices received by the owner from the agency (ADR-011-R2).
   */
  getInvoices: (params?: { year?: number; propertyId?: string }) =>
    ApiClient.get<OwnerPortalInvoice[]>('/owner-portal/invoices', params),

  /**
   * Get withholding tax summary for tax purposes (ADR-011-R2).
   */
  getWithholding: (year: number) =>
    ApiClient.get<OwnerPortalWithholding>(`/owner-portal/withholding?year=${year}`),
};
