import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchAdminInvites, fetchAdminSuppliers, fetchSupplierAudit, inviteSupplier, reactivateSupplier, resendSupplierInvite, revokeSupplierInvite, suspendSupplier } from '@/services/supplier-api';
import type { AdminInvitesParams, AdminSuppliersParams } from '@/types/admin-suppliers';

export function useInviteSupplier() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: inviteSupplier,
    // A new invite shows up in the admin invites list.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ADMIN_INVITES_KEY }),
  });
}


const ADMIN_SUPPLIERS_KEY = ['admin', 'suppliers'] as const;

const ADMIN_INVITES_KEY = ['admin', 'supplier-invites'] as const;


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


/** A page of the supplier invites for the platform admin (SU-12), filtered and paginated by the server. */
export function useAdminInvites(params: AdminInvitesParams) {
  return useQuery({
    queryKey: [...ADMIN_INVITES_KEY, 'list', params],
    queryFn: () => fetchAdminInvites(params),
  });
}


export function useResendSupplierInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (inviteId: string) => resendSupplierInvite(inviteId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ADMIN_INVITES_KEY }),
  });
}


export function useRevokeSupplierInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (inviteId: string) => revokeSupplierInvite(inviteId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ADMIN_INVITES_KEY }),
  });
}
