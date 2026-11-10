import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { tenantAreaApi } from '@/api/tenant-area.api';
import i18n from '@/i18n/config';
import { getProblemMessage } from '@/lib/api-errors';
import type { TenantPaymentDeclarationInput } from '@/types';

export const TENANT_AREA_KEY = 'tenant-area';

export function useTenantContracts() {
  return useQuery({
    queryKey: [TENANT_AREA_KEY],
    queryFn: () => tenantAreaApi.listContracts(),
  });
}

export function useTenantContract(leaseId: string) {
  return useQuery({
    queryKey: [TENANT_AREA_KEY, leaseId],
    queryFn: () => tenantAreaApi.getContract(leaseId),
    enabled: !!leaseId,
    refetchInterval: (query) => query.state.data?.dues.some(due => due.status === 'Processing') ? 3_000 : false,
  });
}

export function useDeclareTransfer(leaseId: string, dueId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: TenantPaymentDeclarationInput) => tenantAreaApi.declareTransfer(leaseId, dueId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [TENANT_AREA_KEY, leaseId] });
      toast.success(i18n.t('tenantArea.declaration.sent'));
    },
    onError: (error) => {
      toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('tenantArea.declaration.failed'));
    },
  });
}

export function useTenantMaintenance(leaseId: string) {
  return useQuery({
    queryKey: [TENANT_AREA_KEY, leaseId, 'maintenance'],
    queryFn: () => tenantAreaApi.listMaintenance(leaseId),
    enabled: !!leaseId,
  });
}

export function useTenantMaintenanceRequest(leaseId: string, requestId: string) {
  return useQuery({
    queryKey: [TENANT_AREA_KEY, leaseId, 'maintenance', requestId],
    queryFn: () => tenantAreaApi.getMaintenance(leaseId, requestId),
    enabled: !!leaseId && !!requestId,
  });
}

export function useCreateTenantMaintenance(leaseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { category: string; urgency: string; description: string; attachments: File[] }) =>
      tenantAreaApi.createMaintenance(leaseId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [TENANT_AREA_KEY, leaseId, 'maintenance'] });
      toast.success(i18n.t('tenantArea.maintenance.sent'));
    },
    onError: (error) => {
      toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('tenantArea.maintenance.failed'));
    },
  });
}
