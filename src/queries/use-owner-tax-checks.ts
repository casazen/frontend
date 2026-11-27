import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ownerTaxChecksApi } from '@/api/owner-tax-checks.api';
import { withoutRequest } from '@/features/marketplace/activation/use-sequential-run';
import type { DecideShortLetTaxCommand } from '@/types';
import { OWNER_ACCOUNTING_KEY } from './use-owner-accounting';

/** Root of the query keys of the checks of the Italian short-let withholding (E18/F01/US03/T01): the stays of a company tenant and the limit of units of an owner. */
const OWNER_TAX_CHECKS_KEY = 'owner-tax-checks';

const ownerTaxChecksKeys = {
  cases: [OWNER_TAX_CHECKS_KEY, 'cases'] as const,
  pendingCases: [OWNER_TAX_CHECKS_KEY, 'cases', 'pending'] as const,
  units: (ownerId: string) => [OWNER_TAX_CHECKS_KEY, 'units', ownerId] as const,
};

/**
 * The stays of a company tenant in the Italian property of a private owner, the ones waiting for a decision and the ones decided (the most recent check-out first, at most 200). The list changes on other screens (a
 * decision recorded from the «Da fare», the owners and the properties of the activation) and the client does not read again on mount by default, so every visit reads again and a read more than half a minute old is
 * stale. `enabled: false` without the flag `taxReportingExports` (the backend answers 404 then) and for who may not manage the owners' finances. `null` when the server refuses it to the caller (403).
 */
export function useCompanyTenantCases(enabled: boolean) {
  return useQuery({
    queryKey: ownerTaxChecksKeys.cases,
    queryFn: () => ownerTaxChecksApi.listCompanyTenantCases(),
    enabled,
    refetchOnMount: 'always' as const,
    staleTime: 30_000,
  });
}

/**
 * The stays that still wait for a decision, on their own. The list of every stay keeps only the 200 with the latest check-out, the decided ones among them, so a stay older than that which still waits for its decision is
 * not in it: the dialog of the decision asks for the waiting ones (`enabled` only when the list did not hold the stay it was opened on) before it tells that the stay needs none. `null` when the server refuses it (403).
 */
export function usePendingCompanyTenantCases(enabled: boolean) {
  return useQuery({
    queryKey: ownerTaxChecksKeys.pendingCases,
    queryFn: () => ownerTaxChecksApi.listCompanyTenantCases('Pending'),
    enabled,
    refetchOnMount: 'always' as const,
    staleTime: 30_000,
  });
}

/**
 * Records the decision about the regime of the stay of a company tenant (⚖ I7): it closes the «Da fare» of the stay (the app reads that list again after every write), and the withholding facts of the next payout
 * follow it. The command holds the note of the agency, so the mutation is dropped as soon as nothing watches it (`gcTime: 0`) and keeps of a failure only the answer of the server (`withoutRequest`). The list of the
 * stays and the owner accounting (the preview of a payout reads the regime) are read again.
 */
export function useDecideCompanyTenant() {
  const queryClient = useQueryClient();
  return useMutation({
    gcTime: 0,
    mutationFn: async (command: DecideShortLetTaxCommand) => {
      try {
        return await ownerTaxChecksApi.decide(command);
      } catch (error) {
        throw withoutRequest(error);
      }
    },
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: [OWNER_TAX_CHECKS_KEY] }),
        queryClient.invalidateQueries({ queryKey: [OWNER_ACCOUNTING_KEY] }),
      ]),
    // A refusal (the stay needs no decision any more, the booking is not there) says that the list on screen is not what the server has: it is read again.
    onError: () => queryClient.invalidateQueries({ queryKey: [OWNER_TAX_CHECKS_KEY] }),
  });
}

/**
 * The limit of units of an owner today: the apartments the agency manages for it, the ones it declared outside the agency, the limit and whether it is presumed to run a business. Read again at every visit; `null` when the
 * server refuses it to the caller (403).
 */
export function useOwnerUnitsCheck(ownerId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ownerTaxChecksKeys.units(ownerId ?? ''),
    queryFn: () => ownerTaxChecksApi.getUnitsCheck(ownerId ?? ''),
    enabled: enabled && Boolean(ownerId),
    refetchOnMount: 'always' as const,
    staleTime: 30_000,
  });
}

/**
 * Saves how many apartments the owner lets short outside the agency (0 to 1000: a number is required, never a 0 by omission). The answer is the new check, which replaces the one on screen, and the owner accounting
 * (the readiness warning of the owner, the regime the next payout reads) is read again.
 */
export function useDeclareExternalUnits(ownerId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    gcTime: 0,
    mutationFn: async (units: number) => {
      try {
        return await ownerTaxChecksApi.declareExternalUnits(ownerId, units);
      } catch (error) {
        throw withoutRequest(error);
      }
    },
    onSuccess: (check) => {
      queryClient.setQueryData(ownerTaxChecksKeys.units(ownerId), check);
      return queryClient.invalidateQueries({ queryKey: [OWNER_ACCOUNTING_KEY] });
    },
  });
}
