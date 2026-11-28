import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { acceptSupplierRequests, fetchSupplierChecklist, fetchSupplierDashboard, fetchSupplierInbox, fetchSupplierInboxCounts, fetchSupplierInboxItem, fetchSupplierOverview, fetchSupplierToday } from '@/services/supplier-api';
import type { SupplierInboxParams, SupplierOverviewPeriod } from '@/types/supplier';

export function useSupplierInbox(params: SupplierInboxParams = { status: 'open' }, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['supplier', 'inbox', 'list', params],
    queryFn: () => fetchSupplierInbox(params),
    enabled: options?.enabled ?? true,
    placeholderData: keepPreviousData,
    refetchOnMount: 'always',
  });
}


export function useSupplierInboxCounts(options?: { enabled?: boolean; refetchOnMount?: boolean | 'always' }) {
  return useQuery({
    queryKey: ['supplier', 'inbox', 'counts'],
    queryFn: fetchSupplierInboxCounts,
    enabled: options?.enabled ?? true,
    refetchOnMount: options?.refetchOnMount ?? 'always',
  });
}

/**
 * Takes up to 20 new requests in one call (SP-04e, `POST inbox/accept`): the lists, the numbers and the home are read again whatever the
 * outcome, because some of the requests may have been taken even when others were not. The outcome per request is the caller's to tell.
 */
export function useAcceptSupplierRequests() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => acceptSupplierRequests(ids),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['service-requests'] });
      void queryClient.invalidateQueries({ queryKey: ['supplier', 'inbox'] });
      void queryClient.invalidateQueries({ queryKey: ['supplier', 'dashboard'] });
    },
  });
}


export function useSupplierToday(days: number) {
  return useQuery({
    queryKey: ['supplier', 'inbox', 'today', days],
    queryFn: () => fetchSupplierToday(days),
    refetchOnMount: 'always',
  });
}


export function useSupplierOverview(period: SupplierOverviewPeriod) {
  return useQuery({
    queryKey: ['supplier', 'dashboard', 'overview', period],
    queryFn: () => fetchSupplierOverview(period),
    refetchOnMount: 'always',
  });
}


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
