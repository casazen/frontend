import { useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { ownerOnboardingApi } from '@/api/owner-onboarding.api';
import { withoutRequest } from '@/features/marketplace/activation/use-sequential-run';
import type { OwnerInvitationStatus } from '@/types/owner-onboarding.types';
import { OWNER_ACCOUNTING_KEY } from './use-owner-accounting';
import { useRestartOnNewWaiting, useWatchWindow } from './use-watch-window';

export const OWNER_ONBOARDING_KEY = 'owner-onboarding';

export const ownerOnboardingKeys = {
  readiness: [OWNER_ONBOARDING_KEY, 'readiness'] as const,
  invitations: [OWNER_ONBOARDING_KEY, 'invitations'] as const,
};

export const OWNER_REFRESH_MS = 30_000;

export const OWNER_WATCH_MS = 10 * 60_000;

const isAwaitingAcceptance = (invitation: Pick<OwnerInvitationStatus, 'state'>): boolean => invitation.state === 'invited';

function refreshOwnerData(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: [OWNER_ONBOARDING_KEY] });
  void queryClient.invalidateQueries({ queryKey: [OWNER_ACCOUNTING_KEY] });
}

/**
 * What is missing for the owner accounting and for the portal, owner by owner and property by property. Derived by the server on every read: nothing
 * here keeps a part «done». `enabled` is false for who may not read it (no agency plan flag, not the organization administrator): such a screen asks
 * nothing, because a 403 on a read sends the whole app to the page of no access. Answers 404 while the backend flag `OctorateOnboarding` is off: the
 * screen shows «not found», never what an older answer held. It has no timer of its own (each read works out the whole portfolio on the server): it is read when the page
 * opens, on return to the tab, after a write, and again when the list of the invitations answers differently (an owner accepted: `useOwnerInvitations`).
 */
export function useOwnerReadiness(enabled: boolean, propertyId?: string) {
  return useQuery({
    queryKey: propertyId ? [...ownerOnboardingKeys.readiness, propertyId] : ownerOnboardingKeys.readiness,
    queryFn: () => ownerOnboardingApi.getReadiness(propertyId),
    enabled,
    gcTime: 0,
    refetchOnMount: 'always',
    staleTime: 10_000,
  });
}

export function useOwnerInvitations(enabled: boolean) {
  const queryClient = useQueryClient();
  const watch = useWatchWindow(OWNER_REFRESH_MS, OWNER_WATCH_MS);
  const query = useQuery({
    queryKey: ownerOnboardingKeys.invitations,
    queryFn: () => ownerOnboardingApi.listInvitations(),
    enabled,
    gcTime: 0,
    refetchOnMount: 'always',
    staleTime: 10_000,
    refetchInterval: (current) => ((current.state.data ?? []).some(isAwaitingAcceptance) && Date.now() - watch.since < OWNER_WATCH_MS ? OWNER_REFRESH_MS : false),
  });
  const waitingIds = (query.data ?? []).filter(isAwaitingAcceptance).map((invitation) => invitation.ownerId);
  useRestartOnNewWaiting(watch, waitingIds);

  const states = query.data === undefined ? null : query.data.map((invitation) => `${invitation.ownerId}:${invitation.state}`).join('|');
  const seen = useRef<string | null>(null);
  useEffect(() => {
    if (states === null) return;
    if (seen.current !== null && seen.current !== states) void queryClient.invalidateQueries({ queryKey: ownerOnboardingKeys.readiness });
    seen.current = states;
  }, [queryClient, states]);

  const { refetch } = query;
  return {
    ...query,
    watchOver: watch.over && waitingIds.length > 0,
    checkAgain: () => {
      watch.restart();
      void refetch();
    },
  };
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
