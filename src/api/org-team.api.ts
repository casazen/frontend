import { ApiClient } from './client';
import type { OnboardingConsentsPayload } from '@/types/onboarding.types';
import type {
  AcceptOrgInvitationResult,
  CreateOrgInvitationRequest,
  OrgInvitation,
  OrgInvitationLink,
  OrgInvitationLookup,
  OrgInvitationSent,
  OrgMember,
  OrgMemberProperties,
  OrgMembersResponse,
  OrgOverview,
  OrgPropertyScope,
  OrgRole,
  OrgRolesResponse,
} from '@/types/org-team.types';

const member = (memberId: string) => `/orgs/me/members/${encodeURIComponent(memberId)}`;
const invitation = (invitationId: string) => `/orgs/me/invitations/${encodeURIComponent(invitationId)}`;

export const orgTeamApi = {
  getOverview: () => ApiClient.get<OrgOverview>('/orgs/me/overview'),

  listMembers: () => ApiClient.get<OrgMembersResponse>('/orgs/me/members'),

  listInvitations: () => ApiClient.get<OrgInvitation[]>('/orgs/me/invitations'),

  getRoles: () => ApiClient.get<OrgRolesResponse>('/orgs/me/roles'),

  getMemberProperties: (memberId: string) => ApiClient.get<OrgMemberProperties>(`/orgs/me/members/${encodeURIComponent(memberId)}/properties`),

  createInvitation: (request: CreateOrgInvitationRequest) => ApiClient.post<OrgInvitationSent>('/orgs/me/invitations', request),

  /**
   * A fresh link for a pending invitation, to give by hand. It rotates the secret (the link of the email stops working), sends
   * nothing and is never cached by the server. The link is a secret: the caller shows it once and does not keep it.
   */
  copyInvitationLink: (invitationId: string) =>
    ApiClient.post<OrgInvitationLink>(`/orgs/me/invitations/${encodeURIComponent(invitationId)}/link`),

  /**
   * What an invitation link is for (anonymous, rate limited). The secret goes in the body, never in a URL. A link that does not
   * work, whatever the reason, gets the same 410.
   */
  lookupInvitation: (token: string) => ApiClient.post<OrgInvitationLookup>('/org-invitations/lookup', { token }, { public: true }),

  acceptInvitation: (token: string, consents: OnboardingConsentsPayload) =>
    ApiClient.post<AcceptOrgInvitationResult>('/org-invitations/accept', { token, consents }),

  changeRole: (memberId: string, role: OrgRole) => ApiClient.put<OrgMember>(member(memberId), { role }),

  setAreas: (memberId: string, areas: readonly string[]) => ApiClient.put<OrgMember>(`${member(memberId)}/areas`, { areas }),

  setProperties: (memberId: string, propertyScope: OrgPropertyScope, propertyIds: readonly string[]) =>
    ApiClient.put<OrgMemberProperties>(`${member(memberId)}/properties`, { propertyScope, propertyIds }),

  deactivateMember: (memberId: string) => ApiClient.post<OrgMember>(`${member(memberId)}/deactivate`),

  reactivateMember: (memberId: string) => ApiClient.post<OrgMember>(`${member(memberId)}/reactivate`),

  resendInvitation: (invitationId: string) => ApiClient.post<OrgInvitationSent>(`${invitation(invitationId)}/resend`),

  revokeInvitation: (invitationId: string) => ApiClient.post<void>(`${invitation(invitationId)}/revoke`),
};
