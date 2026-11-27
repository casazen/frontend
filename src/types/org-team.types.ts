export type OrgRole = 'Owner' | 'Admin' | 'PropertyManager' | 'Collaborator' | 'Accountant';

export type OrgMemberStatus = 'Active' | 'Deactivated';

export type OrgPropertyScope = 'All' | 'Selected';

export interface OrgMember {
  id: string;
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: OrgRole;
  status: OrgMemberStatus;
  propertyScope: OrgPropertyScope;
  areas: string[];
  createdAt: string;
  deactivatedAt: string | null;
}

export type OrgInvitationStatus = 'Pending' | 'Accepted' | 'Revoked' | 'Expired';

export interface OrgInvitation {
  id: string;
  email: string;
  name: string;
  role: OrgRole;
  areas: string[];
  propertyScope: OrgPropertyScope;
  propertyIds: string[];
  status: OrgInvitationStatus;
  createdAt: string;
  /** When an email of the invitation last went out because somebody asked for it (UTC): the creation or the last «reinvia». */
  lastSentAt: string | null;
  expiresAt: string;
  reminderSentAt: string | null;
  invitedByUserId: string;
}

export type OrgInvitationLanguage = 'it' | 'en';

export interface CreateOrgInvitationRequest {
  email: string;
  name: string;
  role: OrgRole;
  areas: string[];
  propertyScope: OrgPropertyScope;
  propertyIds?: string[];
  language?: OrgInvitationLanguage;
}

export interface OrgInvitationSent {
  invitation: OrgInvitation;
  emailQueued: boolean;
}

/** `POST /api/orgs/me/invitations/{id}/link`: a fresh link to hand to the person. It carries the secret: it is never kept. */
export interface OrgInvitationLink {
  invitationId: string;
  url: string;
  expiresAt: string;
}

export interface OrgInvitationLookup {
  orgName: string;
  email: string;
  name: string;
  role: OrgRole;
  areas: string[];
  expiresAt: string;
}

export interface AcceptOrgInvitationResult {
  orgId: string;
  orgName: string;
  role: OrgRole;
  areas: string[];
  leftEmptyOrg: boolean;
}

export type OrgCapabilityLevel = 'Yes' | 'Read' | 'No';

interface OrgCapability {
  id: string;
  group: string;
  level: OrgCapabilityLevel;
}

export interface OrgRoleInfo {
  role: OrgRole;
  assignable: boolean;
  scopeSupported: boolean;
  permissionsByContext: Record<string, { roleKey: string; permissions: string[] }>;
  capabilities: OrgCapability[];
}

export interface OrgRolesResponse {
  roles: OrgRoleInfo[];
}

export interface OrgMemberProperty {
  propertyId: string;
  name: string;
  city: string;
  granted: boolean;
  peopleWithAccess: number;
}

export interface OrgMemberProperties {
  memberId: string;
  role: OrgRole;
  propertyScope: OrgPropertyScope;
  scopeSupported: boolean;
  properties: OrgMemberProperty[];
}

export interface OrgSeats {
  max: number;
  used: number;
  available: number;
  activeMembers: number;
  pendingInvitations: number;
  unlimited: boolean;
  canInvite: boolean;
}

export interface OrgMembersResponse {
  items: OrgMember[];
  seats: OrgSeats;
}

type OrgActivityType =
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
  | 'OrgSettingsChanged'
  | 'PropertyModeChangeScheduled'
  | 'PropertyModeChangeCancelled'
  | 'PropertyModeChanged'
  | 'PropertyActivatedWithReminders'
  | 'OnboardingAssistRequested'
  | 'OnboardingAssistUpdated'
  | 'TrustedSupplierAdded'
  | 'TrustedSupplierRemoved'
  | 'AdminGrantedConcordatoFacileGift';

type OrgActivitySubjectType = 'Member' | 'Invitation' | 'Org' | 'Property' | 'Supplier';

export interface OrgActivityEntry {
  id: string;
  when: string;
  actorUserId: string | null;
  area: string;
  type: OrgActivityType;
  subjectType: OrgActivitySubjectType;
  subjectId: string;
  details: Record<string, string>;
}

export interface OrgOverview {
  standing?: 'ok' | 'attention';
  /** The org is on a higher plan than the one it pays for, because the open access is on. Needs `org.billing.read`. */
  openAccess?: boolean;
  seats?: { used: number; max: number; unlimited: boolean };
  properties?: { total: number; short: number; long: number; toComplete: number };
  invitations?: { pending: number; oldestPendingDays: number | null };
  accessRequests?: { pending: number };
  suppliers?: { trusted: number };
  alloggiati?: { propertiesWithoutCredentials: number };
  recentActivity?: OrgActivityEntry[];
}
