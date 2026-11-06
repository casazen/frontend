import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ownerPortalApi } from '@/api/ownerPortal.api';
import { saveBlobAs } from '@/lib/file-download';
import axios from '@/lib/axios';
import type { OwnerPortalReportQuery } from '@/types';

const OWNER_PORTAL_KEY = 'owner-portal';

/**
 * List properties with occupancy and revenue (ADR-011-R8).
 * Always fresh: read from server on mount.
 */
export function useOwnerProperties() {
  return useQuery({
    queryKey: [OWNER_PORTAL_KEY, 'properties'],
    queryFn: () => ownerPortalApi.getProperties(),
    refetchOnMount: 'always' as const,
  });
}

/**
 * The owner's properties on the Home's numbers for the days of `query` (NF-96): occupancy, revenue, ADR and RevPAR, next to the same
 * days one year earlier when it asks. Read again at every visit; the previous numbers stay on screen while the next load.
 */
export function useOwnerOverview(query: OwnerPortalReportQuery) {
  return useQuery({
    queryKey: [OWNER_PORTAL_KEY, 'overview', query],
    queryFn: () => ownerPortalApi.getOverview(query),
    placeholderData: keepPreviousData,
    refetchOnMount: 'always' as const,
  });
}

/** The same figures week by week or month by month (NF-96), each bucket next to its days one year earlier when asked. */
export function useOwnerTrend(query: OwnerPortalReportQuery) {
  return useQuery({
    queryKey: [OWNER_PORTAL_KEY, 'trend', query],
    queryFn: () => ownerPortalApi.getTrend(query),
    placeholderData: keepPreviousData,
    refetchOnMount: 'always' as const,
  });
}

/**
 * Get published statements for the owner (ADR-011-R2).
 * Only published statements are visible.
 */
export function useOwnerStatements(params?: { year?: number; propertyId?: string }) {
  return useQuery({
    queryKey: [OWNER_PORTAL_KEY, 'statements', params],
    queryFn: () => ownerPortalApi.getStatements(params),
    refetchOnMount: 'always' as const,
  });
}

/**
 * Get invoices received by the owner from the agency (ADR-011-R2).
 */
export function useOwnerInvoices(params?: { year?: number; propertyId?: string }) {
  return useQuery({
    queryKey: [OWNER_PORTAL_KEY, 'invoices', params],
    queryFn: () => ownerPortalApi.getInvoices(params),
    refetchOnMount: 'always' as const,
  });
}

/**
 * Download statement as PDF or CSV.
 * Usage: await downloadStatement(statementId, 'pdf');
 */
export async function downloadStatement(statementId: string, format: 'pdf' | 'csv'): Promise<void> {
  const response = await axios.get(`/owner-portal/statements/${statementId}/download`, {
    params: { format },
    responseType: 'blob',
  });
  const extension = format === 'pdf' ? 'pdf' : 'csv';
  const filename = `statement-${statementId}.${extension}`;
  saveBlobAs(response.data, filename);
}
