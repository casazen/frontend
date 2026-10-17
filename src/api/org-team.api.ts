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

  /** Invites a person: the email goes out at once (`emailQueued` says whether it could be queued) and the invitation holds a seat. */
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

  /** The signed-in account accepts the invitation and joins the org; the four consents of the onboarding are given again for it. */
  acceptInvitation: (token: string, consents: OnboardingConsentsPayload) =>
    ApiClient.post<AcceptOrgInvitationResult>('/org-invitations/accept', { token, consents }),

  /** Gives the member another role; the areas it works in stay. Never the owner role; the administrator role only from the owner. */
  changeRole: (memberId: string, role: OrgRole) => ApiClient.put<OrgMember>(member(memberId), { role }),

  /** Sets the areas the member works in (`short-rent`, `long-rent`; at least one). Role and properties stay as they are. */
  setAreas: (memberId: string, areas: readonly string[]) => ApiClient.put<OrgMember>(`${member(memberId)}/areas`, { areas }),

  /** Sets the properties a member reaches: every one (`All`) or exactly these (`Selected`, a collaborator only). */
  setProperties: (memberId: string, propertyScope: OrgPropertyScope, propertyIds: readonly string[]) =>
    ApiClient.put<OrgMemberProperties>(`${member(memberId)}/properties`, { propertyScope, propertyIds }),

  /** Switches the access off from the member's next request; frees its seat. The account itself is not touched. */
  deactivateMember: (memberId: string) => ApiClient.post<OrgMember>(`${member(memberId)}/deactivate`),

  /** Gives the access back; takes a seat again, so it is refused (409) when the plan has none left. */
  reactivateMember: (memberId: string) => ApiClient.post<OrgMember>(`${member(memberId)}/reactivate`),

  /** Sends the invitation again: a new link and seven more days. An expired one comes back and takes a seat again. */
  resendInvitation: (invitationId: string) => ApiClient.post<OrgInvitationSent>(`${invitation(invitationId)}/resend`),

  /** Withdraws the invitation: its link stops working and the seat is free again. A withdrawn invitation does not come back. */
  revokeInvitation: (invitationId: string) => ApiClient.post<void>(`${invitation(invitationId)}/revoke`),
};
