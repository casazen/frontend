import { useId } from 'react';
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

const KEPT_AFTER_JOINING: readonly string[] = [ORG_INVITATION_LOOKUP_KEY, 'legal'];

export function useOrgOverview() {
  return useQuery({
    queryKey: [ORG_TEAM_KEY, 'overview'],
    queryFn: orgTeamApi.getOverview,
    staleTime: 0,
    refetchOnMount: 'always',
  });
}

export function useOrgMembers(enabled = true, { fresh = false }: { fresh?: boolean } = {}) {
  return useQuery({
    queryKey: [ORG_TEAM_KEY, 'members'],
    queryFn: orgTeamApi.listMembers,
    enabled,
    ...(fresh ? { refetchOnMount: 'always' as const } : {}),
  });
}

export function useOrgInvitations({ fresh = false }: { fresh?: boolean } = {}) {
  return useQuery({
    queryKey: [ORG_TEAM_KEY, 'invitations'],
    queryFn: orgTeamApi.listInvitations,
    ...(fresh ? { refetchOnMount: 'always' as const } : {}),
  });
}

export function useOrgRoles() {
  return useQuery({
    queryKey: [ORG_TEAM_KEY, 'roles'],
    queryFn: orgTeamApi.getRoles,
  });
}

export function useOrgMemberProperties(memberId: string, enabled: boolean, { fresh = false }: { fresh?: boolean } = {}) {
  return useQuery({
    queryKey: [ORG_TEAM_KEY, 'member-properties', memberId],
    queryFn: () => orgTeamApi.getMemberProperties(memberId),
    enabled,
    ...(fresh ? { refetchOnMount: 'always' as const } : {}),
  });
}

export function useCreateOrgInvitation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: orgTeamApi.createInvitation,
    onSettled: () => queryClient.invalidateQueries({ queryKey: [ORG_TEAM_KEY] }),
  });
}

export function useCopyOrgInvitationLink() {
  return useMutation({ mutationFn: orgTeamApi.copyInvitationLink, gcTime: 0 });
}

/** What the link of an invitation is for (anonymous). `token` null: no link, nothing is asked. No retry: the answer is final. */
export function useOrgInvitationLookup(token: string | null) {
  const visit = useId();
  return useQuery({
    queryKey: [ORG_INVITATION_LOOKUP_KEY, visit],
    queryFn: () => orgTeamApi.lookupInvitation(token ?? ''),
    enabled: token !== null,
    retry: false,
    staleTime: Infinity,
    gcTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
  });
}

export function useAcceptOrgInvitation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ token, consents }: { token: string; consents: OnboardingConsentsPayload }) => orgTeamApi.acceptInvitation(token, consents),
    onSuccess: () => {
      queryClient.removeQueries({ predicate: (query) => !KEPT_AFTER_JOINING.includes(String(query.queryKey[0])) });
    },
  });
}

const MEMBER_PROPERTIES_STALE_MS = 60_000;

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
