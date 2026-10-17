import { useMemo } from 'react';
import { useMutation, useQueries, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import { orgTeamApi } from '@/api/org-team.api';
import type { OnboardingConsentsPayload } from '@/types/onboarding.types';
import type { OrgInvitation, OrgMemberProperties, OrgPropertyScope, OrgRole } from '@/types/org-team.types';

const ORG_TEAM_KEY = 'org-team';

/**
 * The lookup of an invitation link. The secret of the link is not in the key: the answer lives only as long as the page that asked
 * for it (`gcTime: 0`), so another link opened later in the tab never finds this one's answer.
 */
const ORG_INVITATION_LOOKUP_KEY = 'org-invitation-lookup';

/** What a person who just joined an org keeps from before: the public legal texts, and the page's own lookup. */
const KEPT_AFTER_JOINING: readonly string[] = [ORG_INVITATION_LOOKUP_KEY, 'legal'];

/**
 * The overview of the account for its home. Other pages change what it counts (people, invitations, properties), so it is read
 * again whenever the home opens: the app does not refetch on mount by itself (`refetchOnMount: false`).
 */
export function useOrgOverview() {
  return useQuery({
    queryKey: [ORG_TEAM_KEY, 'overview'],
    queryFn: orgTeamApi.getOverview,
    staleTime: 0,
    refetchOnMount: 'always',
  });
}

/**
 * The org's people: the home resolves the names of the latest activity with them, the page of the people lists them.
 * `enabled: false` keeps the request from being sent; `fresh` reads them again when the screen opens (the page of the people,
 * not the drawer, which reads what the page has just read).
 */
export function useOrgMembers(enabled = true, { fresh = false }: { fresh?: boolean } = {}) {
  return useQuery({
    queryKey: [ORG_TEAM_KEY, 'members'],
    queryFn: orgTeamApi.listMembers,
    enabled,
    ...(fresh ? { refetchOnMount: 'always' as const } : {}),
  });
}

/** The invitations that wait for an answer (or expired): the people who are not in the team yet. */
export function useOrgInvitations({ fresh = false }: { fresh?: boolean } = {}) {
  return useQuery({
    queryKey: [ORG_TEAM_KEY, 'invitations'],
    queryFn: orgTeamApi.listInvitations,
    ...(fresh ? { refetchOnMount: 'always' as const } : {}),
  });
}

/** The matrix of the roles: what each one holds and how much of each capability that is. It describes roles, not people. */
export function useOrgRoles() {
  return useQuery({
    queryKey: [ORG_TEAM_KEY, 'roles'],
    queryFn: orgTeamApi.getRoles,
  });
}

/**
 * The properties a member reaches, one by one, and how many people reach each. `enabled: false` for a member that reaches them all:
 * nothing to list. `fresh` reads them again when the screen opens (the list of the properties of the account, not its drawer).
 */
export function useOrgMemberProperties(memberId: string, enabled: boolean, { fresh = false }: { fresh?: boolean } = {}) {
  return useQuery({
    queryKey: [ORG_TEAM_KEY, 'member-properties', memberId],
    queryFn: () => orgTeamApi.getMemberProperties(memberId),
    enabled,
    ...(fresh ? { refetchOnMount: 'always' as const } : {}),
  });
}

/** Invites a person. The lists of the team change (a pending invitation holds a seat), and so do the figures of the home. */
export function useCreateOrgInvitation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: orgTeamApi.createInvitation,
    // Also when it is refused: the seats it was refused for may have changed under the page.
    onSettled: () => queryClient.invalidateQueries({ queryKey: [ORG_TEAM_KEY] }),
  });
}

/** A fresh link of a pending invitation, to hand by hand. Nothing in the lists changes: the invitation is the same one. */
export function useCopyOrgInvitationLink() {
  // The link is a secret: the mutation does not keep it (`gcTime: 0`), the caller copies it and `reset`s.
  return useMutation({ mutationFn: orgTeamApi.copyInvitationLink, gcTime: 0 });
}

/** What the link of an invitation is for (anonymous). `token` null: no link, nothing is asked. No retry: the answer is final. */
export function useOrgInvitationLookup(token: string | null) {
  return useQuery({
    queryKey: [ORG_INVITATION_LOOKUP_KEY],
    queryFn: () => orgTeamApi.lookupInvitation(token ?? ''),
    enabled: token !== null,
    retry: false,
    staleTime: Infinity,
    gcTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
  });
}

/** The signed-in account accepts the invitation. Once it has joined, nothing that was read for the org it had before is kept. */
export function useAcceptOrgInvitation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ token, consents }: { token: string; consents: OnboardingConsentsPayload }) => orgTeamApi.acceptInvitation(token, consents),
    onSuccess: () => {
      queryClient.removeQueries({ predicate: (query) => !KEPT_AFTER_JOINING.includes(String(query.queryKey[0])) });
    },
  });
}

/** How long what a collaborator «Solo alcuni» reaches is kept: a person reads it for the names of one property, then for another. */
const MEMBER_PROPERTIES_STALE_MS = 60_000;

/** What the requests of `useOrgMembersProperties` come to: the answers by member, and whether one is still to come or failed. */
function combineMemberProperties(results: UseQueryResult<OrgMemberProperties>[]) {
  const byMember: Record<string, OrgMemberProperties> = {};
  for (const result of results) {
    if (result.data) byMember[result.data.memberId] = result.data;
  }
  return {
    byMember,
    isPending: results.some((result) => result.isPending),
    isError: results.some((result) => result.isError),
  };
}

/**
 * The properties each of these members reaches: one request each (the same ones as `useOrgMemberProperties`, so they are shared),
 * kept for a minute. For the few collaborators limited to some properties: who can open a property, who can be put in charge of it.
 * `retry` asks again for the ones that failed.
 */
export function useOrgMembersProperties(memberIds: readonly string[], enabled: boolean) {
  const queryClient = useQueryClient();
  const answers = useQueries({
    queries: memberIds.map((memberId) => ({
      queryKey: [ORG_TEAM_KEY, 'member-properties', memberId],
      queryFn: () => orgTeamApi.getMemberProperties(memberId),
      enabled,
      staleTime: MEMBER_PROPERTIES_STALE_MS,
      refetchOnMount: true,
    })),
    combine: combineMemberProperties,
  });

  return { ...answers, retry: () => void queryClient.invalidateQueries({ queryKey: [ORG_TEAM_KEY, 'member-properties'] }) };
}

/**
 * What the owner and the administrators do to the people of the team: change a role, the areas and the properties, switch an access
 * off and on, send an invitation again, withdraw it. Plain functions and not mutations, so that the «Annulla» of a toast, which lives
 * on after the dialog that made it has closed, can still call them. Every one reads the team again when it ends, **also when it is
 * refused**: the seats, the roles and the invitations it was refused for may have changed under the page.
 */
export function useOrgTeamActions() {
  const queryClient = useQueryClient();
  return useMemo(() => {
    const refresh = () => queryClient.invalidateQueries({ queryKey: [ORG_TEAM_KEY] });
    const settle = async <T>(call: Promise<T>): Promise<T> => {
      try {
        return await call;
      } finally {
        await refresh();
      }
    };
    return {
      changeRole: (memberId: string, role: OrgRole) => settle(orgTeamApi.changeRole(memberId, role)),
      setAreas: (memberId: string, areas: readonly string[]) => settle(orgTeamApi.setAreas(memberId, areas)),
      setProperties: (memberId: string, scope: OrgPropertyScope, propertyIds: readonly string[]) =>
        settle(orgTeamApi.setProperties(memberId, scope, propertyIds)),
      deactivate: (memberId: string) => settle(orgTeamApi.deactivateMember(memberId)),
      reactivate: (memberId: string) => settle(orgTeamApi.reactivateMember(memberId)),
      resendInvitation: (invitationId: string) => settle(orgTeamApi.resendInvitation(invitationId)),
      revokeInvitation: (invitationId: string) => settle(orgTeamApi.revokeInvitation(invitationId)),
    };
  }, [queryClient]);
}

/**
 * The list of the invitations on the screen, for the one action that waits before it happens: a withdrawn invitation does not come
 * back, so «Annulla l'invito» takes the row out now and withdraws it when the six seconds of the toast are over. `hide` returns what
 * was in the list, `restore` puts it back (the person pressed «Annulla»).
 */
export function useInvitationsCache() {
  const queryClient = useQueryClient();
  return useMemo(() => {
    const key = [ORG_TEAM_KEY, 'invitations'];
    return {
      hide: (invitationId: string): OrgInvitation[] | undefined => {
        const previous = queryClient.getQueryData<OrgInvitation[]>(key);
        queryClient.setQueryData<OrgInvitation[]>(key, (list) => (Array.isArray(list) ? list.filter((invitation) => invitation.id !== invitationId) : list));
        return previous;
      },
      restore: (previous: OrgInvitation[] | undefined) => {
        if (previous) queryClient.setQueryData<OrgInvitation[]>(key, previous);
      },
    };
  }, [queryClient]);
}
