import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { fetchSupplierChecklist, fetchSupplierDashboard, fetchSupplierInbox, fetchSupplierInboxCounts, fetchSupplierInboxItem, fetchSupplierKpis, fetchSupplierOverview, fetchSupplierToday } from '@/services/supplier-api';
import type { SupplierInboxParams, SupplierKpiPeriod, SupplierOverviewPeriod } from '@/types/supplier';

/**
 * A page of the supplier inbox (SU-08): the requests of a tab or of a status, filtered and paginated by the server. The rows of the
 * last search stay, a little dimmed, until those of the next one arrive. It is read again when the page opens: a take, a refusal or a
 * completion made on another page (the request's own) changed it, and the shared client does not read again on mount.
 */
export function useSupplierInbox(params: SupplierInboxParams = { status: 'open' }, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['supplier', 'inbox', 'list', params],
    queryFn: () => fetchSupplierInbox(params),
    enabled: options?.enabled ?? true,
    placeholderData: keepPreviousData,
    refetchOnMount: 'always',
  });
}


/** The numbers on the chips of the list of requests (SP-04e). Under `['supplier', 'inbox']`: every action of the supplier reloads them. */
export function useSupplierInboxCounts() {
  return useQuery({
    queryKey: ['supplier', 'inbox', 'counts'],
    queryFn: fetchSupplierInboxCounts,
    refetchOnMount: 'always',
  });
}


/**
 * What the home shows of today and the next `days` days (SP-04e): the new requests to answer and the jobs. Under `['supplier', 'inbox']`:
 * every action of the supplier reloads it, and it is read again when the page opens (the shared client does not read again on mount).
 */
export function useSupplierToday(days: number) {
  return useQuery({
    queryKey: ['supplier', 'inbox', 'today', days],
    queryFn: () => fetchSupplierToday(days),
    refetchOnMount: 'always',
  });
}


/** The three numbers of the home for a period and the one before it (SP-04e). Under `['supplier', 'dashboard']`: a take or a refusal reloads it. */
export function useSupplierOverview(period: SupplierOverviewPeriod) {
  return useQuery({
    queryKey: ['supplier', 'dashboard', 'overview', period],
    queryFn: () => fetchSupplierOverview(period),
    refetchOnMount: 'always',
  });
}


/** The steps of the activation checklist (SP-04): what the supplier did, and so the next step. Read again when the home opens. */
export function useSupplierChecklist() {
  return useQuery({
    queryKey: ['supplier', 'checklist'],
    queryFn: fetchSupplierChecklist,
    refetchOnMount: 'always',
  });
}


/**
 * One request of the supplier inbox with its history (SU-08). Under `['supplier', 'inbox']`, so take, complete and
 * reject reload it; and read again when the page or the drawer opens, so that what was done from the list shows.
 */
export function useSupplierInboxItem(id: string | undefined) {
  return useQuery({
    queryKey: ['supplier', 'inbox', 'item', id],
    queryFn: () => fetchSupplierInboxItem(id!),
    enabled: !!id,
    refetchOnMount: 'always',
  });
}


export function useSupplierDashboard() {
  return useQuery({
    queryKey: ['supplier', 'dashboard'],
    queryFn: fetchSupplierDashboard,
  });
}


/**
 * Service-request KPIs of the supplier for `period` (SU-11). The counter of "Richieste" in the menu (UI-04a) reads the
 * current month through the same cache entry as the dashboard, and only when `enabled`.
 */
export function useSupplierKpis(period: SupplierKpiPeriod, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['supplier', 'dashboard', 'kpis', period],
    queryFn: () => fetchSupplierKpis(period),
    enabled: options?.enabled ?? true,
  });
}
