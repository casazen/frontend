import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { condominiumProposalApi } from '@/api/condominium-proposal.api';
import type { CondominiumAcceptedProposal, CondominiumManualProposal } from '@/types/condominium-proposal.types';

export const CONDOMINIUM_PROPOSAL_KEY = 'condominium-proposal';

export function useCondominiumProposal(propertyId: string) {
  return useQuery({
    queryKey: [CONDOMINIUM_PROPOSAL_KEY, propertyId],
    queryFn: () => condominiumProposalApi.get(propertyId),
    enabled: propertyId.trim() !== '',
  });
}

export function useSaveCondominiumProposal(propertyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CondominiumAcceptedProposal | CondominiumManualProposal) => condominiumProposalApi.accept(propertyId, body),
    onSuccess: (proposal) => {
      queryClient.setQueryData([CONDOMINIUM_PROPOSAL_KEY, propertyId], proposal);
    },
  });
}

export function useCalculateCondominiumProposal(propertyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { leaseId: string; consuntivo: File; preventivo: File }) =>
      condominiumProposalApi.calculateFromFiles(propertyId, input.leaseId, input.consuntivo, input.preventivo),
    onSuccess: (proposal) => {
      queryClient.setQueryData([CONDOMINIUM_PROPOSAL_KEY, propertyId], proposal);
    },
  });
}
