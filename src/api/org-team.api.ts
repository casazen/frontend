import { ApiClient } from './client';
import type {
  OrgInvitation,
  OrgMemberProperties,
  OrgMembersResponse,
  OrgOverview,
  OrgRolesResponse,
} from '@/types/org-team.types';

/** The team of the org and the home of its account (backend `OrgTeam`, AM-02): the endpoints are for the people of the org. */
export const orgTeamApi = {
  /** The figures of the home of the account, for the owner and the administrators (AM-02c). */
  getOverview: () => ApiClient.get<OrgOverview>('/orgs/me/overview'),

  /** The org's people, owner first, with their seats. */
  listMembers: () => ApiClient.get<OrgMembersResponse>('/orgs/me/members'),

  /** The invitations that are open or expired, newest first. */
  listInvitations: () => ApiClient.get<OrgInvitation[]>('/orgs/me/invitations'),

  /** The matrix «chi può fare cosa»: the five roles with what each holds and how much of each capability that is (AM-02c). */
  getRoles: () => ApiClient.get<OrgRolesResponse>('/orgs/me/roles'),

  /** Every property of the org and whether this member reaches it (AM-03). */
  getMemberProperties: (memberId: string) => ApiClient.get<OrgMemberProperties>(`/orgs/me/members/${encodeURIComponent(memberId)}/properties`),
};
