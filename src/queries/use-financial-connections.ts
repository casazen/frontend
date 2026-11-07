import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { financialConnectionsApi } from '@/api/financial-connections.api';
import type { StripeRentTransferInput } from '@/types';
import { RENT_KEY, RENT_REGISTER_KEY } from './use-rent';
import { TENANT_AREA_KEY } from './use-tenant-area';

export const FINANCIAL_CONNECTIONS_ACCOUNTS_KEY = 'stripe-financial-connections-accounts';

export function useFinancialConnectionsAccounts() {
  return useQuery({
    queryKey: [FINANCIAL_CONNECTIONS_ACCOUNTS_KEY],
    queryFn: () => financialConnectionsApi.listAccounts(),
  });
}

export function useFinancialConnectionsSession() {
  return useMutation({
    mutationFn: () => financialConnectionsApi.createSession(),
  });
}

/** Starts the transfer and reads the due again. It never writes `Paid` into the cache. */
export function useStartStripeRentTransfer(leaseId: string, dueId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ input, idempotencyKey }: { input: StripeRentTransferInput; idempotencyKey: string }) =>
      financialConnectionsApi.startTransfer(leaseId, dueId, input, idempotencyKey),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [TENANT_AREA_KEY, leaseId] });
      void queryClient.invalidateQueries({ queryKey: [RENT_KEY, leaseId] });
      void queryClient.invalidateQueries({ queryKey: [RENT_REGISTER_KEY] });
      void queryClient.invalidateQueries({ queryKey: [FINANCIAL_CONNECTIONS_ACCOUNTS_KEY] });
    },
  });
}
