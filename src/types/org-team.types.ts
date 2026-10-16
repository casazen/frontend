// The team of the org and the home of its account: what `GET /api/orgs/me/overview`, `/members`, `/invitations`, `/roles` and the
// activity log send (backend `OrgOverviewDtos.cs`, `OrgTeamDtos.cs`, `OrgRolesDtos.cs`, `OrgMemberPropertiesDtos.cs`,
// `OrgActivityDtos.cs`). Enums travel as member names.

export type OrgRole = 'Owner' | 'Admin' | 'PropertyManager' | 'Collaborator' | 'Accountant';

export type OrgMemberStatus = 'Active' | 'Deactivated';

/** `All`: every property of the org. `Selected` («Solo alcuni»): only the ones the person was given; a collaborator only. */
export type OrgPropertyScope = 'All' | 'Selected';

/** A member of the org. `id` is the member row (what the endpoints that change a member address), `userId` the account. */
export interface OrgMember {
  id: string;
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: OrgRole;
  status: OrgMemberStatus;
  propertyScope: OrgPropertyScope;
  /** The areas the person works in: `short-rent`, `long-rent`. */
  areas: string[];
  /** UTC. */
  createdAt: string;
  /** When the access was switched off (UTC); null while active. */
  deactivatedAt: string | null;
}

/** `Pending` while the link can be used, `Expired` after; the list of the team holds only those two. */
export type OrgInvitationStatus = 'Pending' | 'Accepted' | 'Revoked' | 'Expired';

/** An invitation that waits for an answer (`GET /api/orgs/me/invitations`). The token of the link is never sent. */
export interface OrgInvitation {
  id: string;
  email: string;
  name: string;
  role: OrgRole;
  areas: string[];
  propertyScope: OrgPropertyScope;
  /** The properties a `Selected` collaborator gets on accepting: ids only. */
  propertyIds: string[];
  status: OrgInvitationStatus;
  /** UTC. */
  createdAt: string;
  /** When the link stops working (UTC). */
  expiresAt: string;
  /** The account that invited (`OrgMember.userId`). */
  invitedByUserId: string;
}

/** What a role does with one capability of the matrix: sees and changes it, only sees it, or neither. */
export type OrgCapabilityLevel = 'Yes' | 'Read' | 'No';

/** One of the twelve capabilities of the matrix. `id` is a stable key the client translates; `group` is `short-rent`, `long-rent`, `both` or `account`. */
export interface OrgCapability {
  id: string;
  group: string;
  level: OrgCapabilityLevel;
}

/** One role of the matrix (`GET /api/orgs/me/roles`): what it holds in each context and how much of each capability that is. */
export interface OrgRoleInfo {
  role: OrgRole;
  /** The caller may give this role to a person. */
  assignable: boolean;
  /** The role can be limited to some properties: the collaborator only. */
  scopeSupported: boolean;
  /** The contexts the role has a row in (`account`, `short-rent`, `long-rent`): a context it has none in is absent. */
  permissionsByContext: Record<string, { roleKey: string; permissions: string[] }>;
  capabilities: OrgCapability[];
}

/** `GET /api/orgs/me/roles`: the five roles, owner first. */
export interface OrgRolesResponse {
  roles: OrgRoleInfo[];
}

/** One property in the access of a member: whether it reaches it. */
export interface OrgMemberProperty {
  propertyId: string;
  name: string;
  city: string;
  granted: boolean;
  /** How many active people of the org reach it. */
  peopleWithAccess: number;
}

/** `GET /api/orgs/me/members/{id}/properties`: every property of the org and whether the member reaches it. */
export interface OrgMemberProperties {
  memberId: string;
  role: OrgRole;
  propertyScope: OrgPropertyScope;
  scopeSupported: boolean;
  properties: OrgMemberProperty[];
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
