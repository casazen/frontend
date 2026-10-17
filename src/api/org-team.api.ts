import { ApiClient } from './client';
import type { OnboardingConsentsPayload } from '@/types/onboarding.types';
import type {
  AcceptOrgInvitationResult,
  CreateOrgInvitationRequest,
  OrgInvitation,
  OrgInvitationLink,
  OrgInvitationLookup,
  OrgInvitationSent,
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
};
