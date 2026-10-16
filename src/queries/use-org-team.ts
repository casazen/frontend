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

/** The org's people: the home resolves the names of the latest activity with them. `enabled: false` keeps the request from being sent. */
export function useOrgMembers(enabled = true) {
  return useQuery({
    queryKey: [ORG_TEAM_KEY, 'members'],
    queryFn: orgTeamApi.listMembers,
    enabled,
  });
}
