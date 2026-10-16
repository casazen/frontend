import { ApiClient } from './client';
import type { OrgMembersResponse, OrgOverview } from '@/types/org-team.types';

/** The team of the org and the home of its account (backend `OrgTeam`, AM-02): the endpoints are for the people of the org. */
export const orgTeamApi = {
  /** The figures of the home of the account, for the owner and the administrators (AM-02c). */
  getOverview: () => ApiClient.get<OrgOverview>('/orgs/me/overview'),

  /** The org's people, owner first, with their seats. */
  listMembers: () => ApiClient.get<OrgMembersResponse>('/orgs/me/members'),
};
