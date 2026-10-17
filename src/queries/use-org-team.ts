import { useQueries, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import { orgTeamApi } from '@/api/org-team.api';
import type { OrgMemberProperties } from '@/types/org-team.types';

const ORG_TEAM_KEY = 'org-team';

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
