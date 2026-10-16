import { useQuery } from '@tanstack/react-query';
import { orgTeamApi } from '@/api/org-team.api';

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

/** The properties a member reaches, one by one. `enabled: false` for a member that reaches them all: nothing to list. */
export function useOrgMemberProperties(memberId: string, enabled: boolean) {
  return useQuery({
    queryKey: [ORG_TEAM_KEY, 'member-properties', memberId],
    queryFn: () => orgTeamApi.getMemberProperties(memberId),
    enabled,
  });
}
