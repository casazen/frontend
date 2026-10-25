import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { trustedSuppliersApi, type InviteSupplierDto } from '@/api/trusted-suppliers.api';
import { toast } from 'sonner';
import i18n from '@/i18n/config';
import { getProblemMessage } from '@/lib/api-errors';

const TRUSTED_SUPPLIERS_KEY = 'trusted-suppliers';

export function useTrustedSuppliers() {
  return useQuery({
    queryKey: [TRUSTED_SUPPLIERS_KEY],
    queryFn: () => trustedSuppliersApi.getAll(),
  });
}

export function useInviteSupplier() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: InviteSupplierDto) => trustedSuppliersApi.invite(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [TRUSTED_SUPPLIERS_KEY] });
      toast.success(i18n.t('supplier.trusted.inviteSuccess'));
    },
    onError: (error) => {
      toast.error(getProblemMessage(error) ?? i18n.t('supplier.trusted.inviteError'));
    },
  });
}

export function useUpdateVisibility() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, visible }: { id: string; visible: boolean }) =>
      trustedSuppliersApi.updateVisibility(id, { visibleInMarketplace: visible }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [TRUSTED_SUPPLIERS_KEY] });
      toast.success(i18n.t('supplier.trusted.visibilitySuccess'));
    },
    onError: (error) => {
      toast.error(getProblemMessage(error) ?? i18n.t('supplier.trusted.visibilityError'));
    },
  });
}

export function useRemoveSupplier() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => trustedSuppliersApi.remove(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [TRUSTED_SUPPLIERS_KEY] });
      toast.success(i18n.t('supplier.trusted.removeSuccess'));
    },
    onError: (error) => {
      toast.error(getProblemMessage(error) ?? i18n.t('supplier.trusted.removeError'));
    },
  });
}
