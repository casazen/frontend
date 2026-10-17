import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { orgTeamApi } from '@/api/org-team.api';
import type { OnboardingConsentsPayload } from '@/types/onboarding.types';

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

/** The properties a member reaches, one by one. `enabled: false` for a member that reaches them all: nothing to list. */
export function useOrgMemberProperties(memberId: string, enabled: boolean) {
  return useQuery({
    queryKey: [ORG_TEAM_KEY, 'member-properties', memberId],
    queryFn: () => orgTeamApi.getMemberProperties(memberId),
    enabled,
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
