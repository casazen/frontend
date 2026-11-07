import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { bankLinkApi } from '@/api/financial-connections.api';
import type { StartOrgBankLinkPayment } from '@/types';
import { PUBLIC_RENT_KEY, RENT_KEY, RENT_REGISTER_KEY } from './use-rent';

export const ORG_BANK_LINK_KEY = 'org-bank-link';

export function useOrgBankLink(enabled: boolean) {
  return useQuery({
    queryKey: [ORG_BANK_LINK_KEY],
    queryFn: () => bankLinkApi.getOrgAccount(),
    enabled,
  });
}

export function useCreateOrgBankLinkSession() {
  return useMutation({
    mutationFn: () => bankLinkApi.createOrgSession(),
  });
}

export function useAttachOrgBankLink() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (accountId: string) => bankLinkApi.attachOrgAccount(accountId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [ORG_BANK_LINK_KEY] });
    },
  });
}

/** Starts the debit and reads the due again. It never writes `Paid` into the cache. */
export function useStartOrgBankLinkPayment(leaseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ input, idempotencyKey }: { input: StartOrgBankLinkPayment; idempotencyKey: string }) =>
      bankLinkApi.startOrgPayment(input, idempotencyKey),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [RENT_KEY, leaseId] });
      void queryClient.invalidateQueries({ queryKey: [RENT_REGISTER_KEY] });
    },
  });
}

export function useCreateRentBankLinkSession() {
  return useMutation({
    mutationFn: ({ installmentId, token }: { installmentId: string; token: string }) =>
      bankLinkApi.createRentSession(installmentId, token),
  });
}

export function useAttachRentBankLink() {
  return useMutation({
    mutationFn: ({ installmentId, token, accountId }: { installmentId: string; token: string; accountId: string }) =>
      bankLinkApi.attachRentAccount(installmentId, token, accountId),
  });
}

export function useStartRentBankLinkPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ installmentId, token, idempotencyKey }: { installmentId: string; token: string; idempotencyKey: string }) =>
      bankLinkApi.startRentPayment(installmentId, token, idempotencyKey),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [PUBLIC_RENT_KEY] });
    },
  });
}
