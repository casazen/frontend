import { useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { ownerOnboardingApi } from '@/api/owner-onboarding.api';
import { withoutRequest } from '@/features/marketplace/activation/use-sequential-run';
import type { OwnerInvitationStatus } from '@/types/owner-onboarding.types';
import { OWNER_ACCOUNTING_KEY } from './use-owner-accounting';
import { useRestartOnNewWaiting, useWatchWindow } from './use-watch-window';

/** Root of the keys of the owner portfolio in the onboarding of an agency (E10/F02/US02, NF-109). */
export const OWNER_ONBOARDING_KEY = 'owner-onboarding';

export const ownerOnboardingKeys = {
  readiness: [OWNER_ONBOARDING_KEY, 'readiness'] as const,
  invitations: [OWNER_ONBOARDING_KEY, 'invitations'] as const,
};

/**
 * A page open on the screen is read again when it opens, when the person comes back to it and after whatever they do on it. The server sends no push for the acceptance of an
 * invitation, so while a link is in force (some owner is `invited`) the list of the invitations is also read again every thirty seconds, for ten minutes at most (see
 * `useOwnerInvitations`); a tab in the background does not ask. Both reads hold the names of the owners of the agency (third parties): they are dropped as soon as no screen
 * shows them (`gcTime: 0`), not kept in memory for the default ten minutes after the person has left.
 */
export const OWNER_REFRESH_MS = 30_000;

/**
 * How long a page keeps asking by itself for the acceptance of a link: ten minutes from when it opened, from the moment a link starts to wait (the confirmation of a batch, a new
 * link) or from the last «Controlla di nuovo». Each read works out the whole portfolio of the agency on the server, so after it the page stops (no endless polling of a tab
 * left open), says in neutral words that it no longer asks by itself and offers a button that asks again.
 */
export const OWNER_WATCH_MS = 10 * 60_000;

/** A link is in force and the owner may still accept it: the only state of an invitation that is on its way. */
const isAwaitingAcceptance = (invitation: Pick<OwnerInvitationStatus, 'state'>): boolean => invitation.state === 'invited';

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

/**
 * Every owner with the state of its invitation (`ready`, `invited`, `accepted`, `expired`, `revoked`); no address and no link. Same rules as the readiness. While a link is in
 * force (some owner is `invited`) it is read again every thirty seconds, up to `OWNER_WATCH_MS` from when the page opened, from the moment a link starts to wait or from the last
 * `checkAgain`: `watchOver` says that the window is over while a link is still waiting. With no link in force there is nothing to wait for and nothing is asked by itself. When the
 * states answered differ from the ones before, the readiness is read again too: it tells the same acceptance in its own words (the portal of the owner).
 */
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
