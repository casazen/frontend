import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { condominiumProposalApi, isNothingLoaded } from '@/api/condominium-proposal.api';
import type { ProposeTenantExpense, TenantExpenseProposal } from '@/types/condominium-proposal.types';

export const CONDOMINIUM_EXPENSE_KEY = 'lease-condominium-expense';

export interface CondominiumExpenseView {
  /** The fiscal-year proposal, or null when nothing is loaded yet. */
  proposal: TenantExpenseProposal | null;
  /**
   * The choice the person kept. While this is set, opening the step again must not POST an empty body:
   * that answer is a budget and drops `settledAtConsuntivo`.
   */
  saved: { proposal: TenantExpenseProposal; request: ProposeTenantExpense } | null;
}

export function condominiumExpenseKey(leaseId: string) {
  return [CONDOMINIUM_EXPENSE_KEY, leaseId] as const;
}

/**
 * Reads the expense already kept for this lease, or asks once whether a fiscal year can propose one.
 * A saved choice is returned as it is. The empty POST is not repeated: it is a write of a budget.
 */
export function useCondominiumExpenseProbe(leaseId: string, enabled: boolean) {
  const queryClient = useQueryClient();
  const key = condominiumExpenseKey(leaseId);
  return useQuery({
    queryKey: key,
    queryFn: async (): Promise<CondominiumExpenseView> => {
      const cached = queryClient.getQueryData<CondominiumExpenseView>(key);
      if (cached?.saved) return cached;
      try {
        return { proposal: await condominiumProposalApi.propose(leaseId, {}), saved: null };
      } catch (error) {
        if (isNothingLoaded(error)) return { proposal: null, saved: null };
        throw error;
      }
    },
    enabled,
    retry: false,
    refetchOnWindowFocus: false,
  });
}

export function useProposeCondominiumExpense(leaseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: ProposeTenantExpense) => condominiumProposalApi.propose(leaseId, body),
    onSuccess: (proposal, request) => {
      rememberCondominiumExpense(queryClient, leaseId, proposal, request);
    },
  });
}

/** Keeps a proposal on the lease so the economic step still shows it after it unmounts. */
export function useRememberCondominiumExpense(leaseId: string) {
  const queryClient = useQueryClient();
  return (proposal: TenantExpenseProposal, request: ProposeTenantExpense) => {
    rememberCondominiumExpense(queryClient, leaseId, proposal, request);
  };
}

function rememberCondominiumExpense(
  queryClient: QueryClient,
  leaseId: string,
  proposal: TenantExpenseProposal,
  request: ProposeTenantExpense,
) {
  queryClient.setQueryData<CondominiumExpenseView>(condominiumExpenseKey(leaseId), (current) => ({
    proposal: current?.proposal ?? null,
    saved: { proposal, request },
  }));
}
