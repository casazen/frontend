import { useMutation, useQuery } from '@tanstack/react-query';
import { condominiumProposalApi, isNothingLoaded } from '@/api/condominium-proposal.api';
import type { ProposeTenantExpense, TenantExpenseProposal } from '@/types/condominium-proposal.types';

export const CONDOMINIUM_EXPENSE_KEY = 'lease-condominium-expense';

/** `null` when the property has no fiscal year yet (422 `tenant_expense_proposal_invalid`). */
export function useCondominiumExpenseProbe(leaseId: string, enabled: boolean) {
  return useQuery({
    queryKey: [CONDOMINIUM_EXPENSE_KEY, leaseId],
    queryFn: async (): Promise<TenantExpenseProposal | null> => {
      try {
        return await condominiumProposalApi.propose(leaseId, {});
      } catch (error) {
        if (isNothingLoaded(error)) return null;
        throw error;
      }
    },
    enabled,
    retry: false,
    refetchOnWindowFocus: false,
  });
}

export function useProposeCondominiumExpense(leaseId: string) {
  return useMutation({
    mutationFn: (body: ProposeTenantExpense) => condominiumProposalApi.propose(leaseId, body),
  });
}
