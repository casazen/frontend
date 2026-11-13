import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { ownerOnboardingApi } from '@/api/owner-onboarding.api';
import { withoutRequest } from '@/features/marketplace/activation/use-sequential-run';
import { OWNER_ACCOUNTING_KEY } from './use-owner-accounting';

/** Root of the keys of the owner portfolio in the onboarding of an agency (E10/F02/US02, NF-109). */
export const OWNER_ONBOARDING_KEY = 'owner-onboarding';

export const ownerOnboardingKeys = {
  readiness: [OWNER_ONBOARDING_KEY, 'readiness'] as const,
  invitations: [OWNER_ONBOARDING_KEY, 'invitations'] as const,
};

/**
 * A page open on the screen asks again by itself: the owner who accepts, the file that was just imported and the invitation that lapsed show up
 * without a reload. The server sends no push for the acceptance of an invitation, so the answer is read every thirty seconds while the page is visible
 * (a tab in the background does not ask). Both reads hold the names of the owners of the agency (third parties): they are dropped as soon as no screen shows them
 * (`gcTime: 0`), not kept in memory for the default ten minutes after the person has left.
 */
const REFRESH_MS = 30_000;

/**
 * Whatever a write of the owner portfolio changes: the readiness and the states of the invitations, and the owner accounting that reads the same
 * facts (the «Dati finanziari» of an owner, the month-end close).
 */
function refreshOwnerData(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: [OWNER_ONBOARDING_KEY] });
  void queryClient.invalidateQueries({ queryKey: [OWNER_ACCOUNTING_KEY] });
}

/**
 * What is missing for the owner accounting and for the portal, owner by owner and property by property. Derived by the server on every read: nothing
 * here keeps a part «done». `enabled` is false for who may not read it (no agency plan flag, not the organization administrator): such a screen asks
 * nothing, because a 403 on a read sends the whole app to the page of no access. Answers 404 while the backend flag `OctorateOnboarding` is off: the
 * screen shows «not found», never what an older answer held.
 */
export function useOwnerReadiness(enabled: boolean) {
  return useQuery({
    queryKey: ownerOnboardingKeys.readiness,
    queryFn: () => ownerOnboardingApi.getReadiness(),
    enabled,
    gcTime: 0,
    refetchOnMount: 'always',
    staleTime: 10_000,
    refetchInterval: enabled ? REFRESH_MS : false,
  });
}

/** Every owner with the state of its invitation (`ready`, `invited`, `accepted`, `expired`, `revoked`); no address and no link. Same rules as the readiness. */
export function useOwnerInvitations(enabled: boolean) {
  return useQuery({
    queryKey: ownerOnboardingKeys.invitations,
    queryFn: () => ownerOnboardingApi.listInvitations(),
    enabled,
    gcTime: 0,
    refetchOnMount: 'always',
    staleTime: 10_000,
    refetchInterval: enabled ? REFRESH_MS : false,
  });
}

/**
 * Checks (`dryRun`) or imports the file of the owners. The file holds names, e-mail addresses, fiscal codes and IBANs, and the answer holds the names of
 * the owners: a mutation would keep both in the cache of the mutations for five minutes by default, after the panel is gone. Here it is dropped as soon
 * as nothing observes it (`gcTime: 0`), and a refusal is kept without the request that was sent (`withoutRequest`: the status and the body of the
 * answer stay, which is what a screen turns into words). The import never sends an invitation: it never calls any endpoint of the invitations.
 */
export function useImportOwners() {
  const queryClient = useQueryClient();

  return useMutation({
    gcTime: 0,
    mutationFn: async ({ file, dryRun }: { file: File; dryRun: boolean }) => {
      try {
        return await ownerOnboardingApi.importOwners(file, dryRun);
      } catch (error) {
        throw withoutRequest(error);
      }
    },
    onSuccess: (_result, { dryRun }) => {
      if (!dryRun) refreshOwnerData(queryClient);
    },
  });
}

/**
 * The batch that confirming would send: nothing is sent by asking. The answer holds the address each link would go to, so, like the import, it is
 * dropped as soon as nothing observes it (`gcTime: 0`).
 */
export function usePreviewOwnerInvitations() {
  return useMutation({
    gcTime: 0,
    mutationFn: async (ownerIds: readonly string[]) => {
      try {
        return await ownerOnboardingApi.previewInvitations(ownerIds);
      } catch (error) {
        throw withoutRequest(error);
      }
    },
  });
}

/** Sends the batch of a preview, the one act that sends. Whatever the answer (a 409 «the owners changed» included), the states are read again. */
export function useConfirmOwnerInvitations() {
  const queryClient = useQueryClient();

  return useMutation({
    gcTime: 0,
    mutationFn: async ({ ownerIds, fingerprint }: { ownerIds: readonly string[]; fingerprint: string }) => {
      try {
        return await ownerOnboardingApi.confirmInvitations(ownerIds, fingerprint);
      } catch (error) {
        throw withoutRequest(error);
      }
    },
    onSettled: () => refreshOwnerData(queryClient),
  });
}

/** A new link to the owner of an invitation, the one in force withdrawn. A different act from the withdrawal: it asks its own confirmation. */
export function useResendOwnerInvitation() {
  const queryClient = useQueryClient();

  return useMutation({
    gcTime: 0,
    mutationFn: async (invitationId: string) => {
      try {
        return await ownerOnboardingApi.resendInvitation(invitationId);
      } catch (error) {
        throw withoutRequest(error);
      }
    },
    onSettled: () => refreshOwnerData(queryClient),
  });
}

/** Withdraws an invitation in force: its link stops working and nothing new is sent. */
export function useRevokeOwnerInvitation() {
  const queryClient = useQueryClient();

  return useMutation({
    gcTime: 0,
    mutationFn: async (invitationId: string) => {
      try {
        return await ownerOnboardingApi.revokeInvitation(invitationId);
      } catch (error) {
        throw withoutRequest(error);
      }
    },
    onSettled: () => refreshOwnerData(queryClient),
  });
}

/**
 * The owner accepts the invitation of the e-mail. The secret token is the variable of this mutation, so it is dropped as soon as nothing observes it
 * (`gcTime: 0`) and the page resets the mutation when it is done; a refusal is kept without the request that carried the token (`withoutRequest`).
 * Nothing is read again afterwards: the owner has no host data to refresh.
 */
export function useAcceptOwnerInvitation() {
  return useMutation({
    gcTime: 0,
    mutationFn: async (token: string) => {
      try {
        return await ownerOnboardingApi.acceptInvitation(token);
      } catch (error) {
        throw withoutRequest(error);
      }
    },
  });
}
