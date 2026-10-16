// The team of the org and the home of its account: what `GET /api/orgs/me/overview`, `/members` and the activity log send
// (backend `OrgOverviewDtos.cs`, `OrgTeamDtos.cs`, `OrgActivityDtos.cs`). Enums travel as member names.

export type OrgRole = 'Owner' | 'Admin' | 'PropertyManager' | 'Collaborator' | 'Accountant';

export type OrgMemberStatus = 'Active' | 'Deactivated';

/** A member of the org. `id` is the member row (what the endpoints that change a member address), `userId` the account. */
export interface OrgMember {
  id: string;
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: OrgRole;
  status: OrgMemberStatus;
  /** The areas the person works in: `short-rent`, `long-rent`. */
  areas: string[];
}

/** `GET /api/orgs/me/members`: the org's people, owner first. */
export interface OrgMembersResponse {
  items: OrgMember[];
}

/** What happened (`OrgActivityType`): the log holds the code and the ids, the client composes the sentence. */
export type OrgActivityType =
  | 'MemberInvited'
  | 'InvitationRevoked'
  | 'InvitationAccepted'
  | 'MemberRoleChanged'
  | 'MemberDeactivated'
  | 'MemberReactivated'
  | 'MemberRemoved'
  | 'MemberPropertyAccessChanged'
  | 'AccessRequested'
  | 'MemberAreasChanged'
  | 'PlanChanged'
  | 'OrgNameChanged'
  | 'OrgSlugChanged'
  | 'PropertyModeChangeScheduled'
  | 'PropertyModeChangeCancelled'
  | 'PropertyModeChanged'
  | 'TrustedSupplierAdded'
  | 'TrustedSupplierRemoved';

/** What the id of a line points to (`OrgActivitySubjectType`). */
export type OrgActivitySubjectType = 'Member' | 'Invitation' | 'Org' | 'Property' | 'Supplier';

/** One line of the activity log. Ids and short codes only: never a name, an email or a free text. */
export interface OrgActivityEntry {
  id: string;
  /** UTC. */
  when: string;
  /** The account that did it (`OrgMember.userId`); null when nobody did (a job, a webhook). */
  actorUserId: string | null;
  /** `account`, `short-rent`, `long-rent` or `supplier`. */
  area: string;
  type: OrgActivityType;
  subjectType: OrgActivitySubjectType;
  /** A member's account id, an invitation, the org, a property or a supplier, by `subjectType`. */
  subjectId: string;
  /** A few short codes (a role, a tier, a count) that the type allows. */
  details: Record<string, string>;
}

/**
 * `GET /api/orgs/me/overview` (AM-02c): what the home of the account shows, in one answer, for the owner and the administrators.
 * A section the caller has no permission for is left out of the answer, not sent empty.
 */
export interface OrgOverview {
  /** `attention` while a payment of the plan failed or the subscription is unpaid or incomplete. Needs `org.billing.read`. */
  standing?: 'ok' | 'attention';
  /** The org is on a higher plan than the one it pays for, because the open access is on. Needs `org.billing.read`. */
  openAccess?: boolean;
  /** Seats in use (active people and pending invitations) out of what the plan allows; `max` is int max when `unlimited`. */
  seats?: { used: number; max: number; unlimited: boolean };
  /** The properties the caller reaches; `toComplete` are short-term ones that cannot receive bookings yet. */
  properties?: { total: number; short: number; long: number; toComplete: number };
  /** Invitations that can still be accepted, and the whole days the oldest has waited (null with none). */
  invitations?: { pending: number; oldestPendingDays: number | null };
  /** Requests for access waiting for an answer: 0 until the queue of the requests exists. */
  accessRequests?: { pending: number };
  /** Trusted suppliers: 0 until they exist. */
  suppliers?: { trusted: number };
  /** Short-term properties without Alloggiati Web credentials. */
  alloggiati?: { propertiesWithoutCredentials: number };
  /** The latest three things people did, newest first. Needs `org.activity.read`. */
  recentActivity?: OrgActivityEntry[];
}
