import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchAdminSuppliers, fetchSupplierAudit, reactivateSupplier, suspendSupplier } from '@/services/supplier-api';
import type { AdminSuppliersParams } from '@/types/admin-suppliers';

const ADMIN_SUPPLIERS_KEY = ['admin', 'suppliers'] as const;


/** A page of the suppliers for the platform admin (SU-12), filtered and paginated by the server. */
export function useAdminSuppliers(params: AdminSuppliersParams) {
  return useQuery({
    queryKey: [...ADMIN_SUPPLIERS_KEY, 'list', params],
    queryFn: () => fetchAdminSuppliers(params),
  });
}


/** Audit trail of one supplier; loaded only while its dialog is open. */
export function useSupplierAudit(orgId: string | undefined) {
  return useQuery({
    queryKey: [...ADMIN_SUPPLIERS_KEY, 'audit', orgId],
    queryFn: () => fetchSupplierAudit(orgId!),
    enabled: !!orgId,
  });
}


export function useSuspendSupplier() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ orgId, reason }: { orgId: string; reason: string }) => suspendSupplier(orgId, reason),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ADMIN_SUPPLIERS_KEY }),
  });
}


export function useReactivateSupplier() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (orgId: string) => reactivateSupplier(orgId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ADMIN_SUPPLIERS_KEY }),
  });
}
