import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { DRAFT_KEY } from './use-lease-draft';
import { condominiumProposalApi } from '@/api/condominium-proposal.api';
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
 * The expense already kept for this lease is restored with GET. Opening never posts a budget:
 * `POST` with an empty body is a write of a budget and drops settle-at-consuntivo.
 * The persisted choice also stays cached for the life of the draft. The default cache lifetime would drop it
 * when the step unmounts, and the next open would look empty.
 */
export function useCondominiumExpenseProbe(leaseId: string, enabled: boolean) {
  const queryClient = useQueryClient();
  const key = condominiumExpenseKey(leaseId);
  return useQuery({
    queryKey: key,
    queryFn: async (): Promise<CondominiumExpenseView> => {
      const cached = queryClient.getQueryData<CondominiumExpenseView>(key);
      if (cached?.saved) return cached;
      const saved = await condominiumProposalApi.saved(leaseId);
      return { proposal: null, saved: saved ? { proposal: saved, request: {} } : null };
    },
    enabled: enabled && leaseId.trim() !== '',
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: Infinity,
    gcTime: Infinity,
  });
}

export function useProposeCondominiumExpense(leaseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: ProposeTenantExpense) => condominiumProposalApi.propose(leaseId, body),
    onSuccess: (proposal, request) => {
      rememberCondominiumExpense(queryClient, leaseId, proposal, request);
      void queryClient.invalidateQueries({ queryKey: [DRAFT_KEY, leaseId] });
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
