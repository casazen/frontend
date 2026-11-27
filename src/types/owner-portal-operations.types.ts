import type { OwnerExternalDocumentStatus } from './owner-accounting.types';

/**
 * The operations of the owner portal (E07/F07/US01, NF-111, ADR-011): the contract of the endpoints `api/owner-portal/calendar|stays|documents|
 * contacts|conversations|inbox/preferences|external-documents` and `api/owner-contacts/accept`, written from the controllers of the backend.
 *
 * The API writes the enums by name (`Requested`, `StatementVersion`), the days as `yyyy-MM-dd` and the instants as UTC ISO strings; a member
 * without a value is `null` (or left out), so every optional member is read as «nothing» when it is `null` or `undefined`.
 *
 * NO type here carries a guest: the calendar says dates and a neutral kind, a stay has no price, a document has no guest, a message has the name of
 * the person of the portal or the word of the agency. There is no member for a guest name, e-mail, phone, document or channel, and none may be added
 * (ADR-011-R3, AC-NF111-1).
 */

export type OwnerPortalPermission = 'calendar.read' | 'stays.request' | 'accounting.read' | 'documents.read' | 'inbox.use';

export const OWNER_PORTAL_PERMISSIONS: readonly OwnerPortalPermission[] = [
  'calendar.read',
  'stays.request',
  'accounting.read',
  'documents.read',
  'inbox.use',
];

type OwnerCalendarKind = 'available' | 'occupied' | 'blocked' | 'ownerStay';

export type OwnerStayState = 'requested' | 'approved_syncing' | 'confirmed' | 'sync_failed' | 'rejected' | 'cancelled';

type OwnerStayStatus = 'Requested' | 'Approved' | 'Rejected' | 'Cancelled';

type OwnerStaySyncState = 'None' | 'Pending' | 'Acknowledged' | 'Failed';

export interface OwnerCalendarRange {
  start: string;
  end: string;
  kind: OwnerCalendarKind;
  stayId?: string | null;
  stayState?: OwnerStayState | null;
}

export interface OwnerCalendar {
  propertyId: string;
  from: string;
  to: string;
  ranges: OwnerCalendarRange[];
}

export interface OwnerStay {
  id: string;
  orgId: string;
  propertyId: string;
  propertyName: string;
  propertyOwnerId: string;
  startDate: string;
  endDate: string;
  nights: number;
  status: OwnerStayStatus;
  state: OwnerStayState;
  syncState: OwnerStaySyncState;
  releaseSyncState: OwnerStaySyncState;
  syncErrorCode?: string | null;
  requestedAt: string;
  decidedAt?: string | null;
  cancelledAt?: string | null;
  requestedByContact: boolean;
}

interface OwnerStayBlackout {
  from: string;
  to: string;
}

export interface OwnerStayRule {
  id?: string | null;
  propertyId: string;
  propertyOwnerId?: string | null;
  yearlyNightAllowance?: number | null;
  minAdvanceDays: number;
  maxAdvanceDays?: number | null;
  minNights: number;
  maxNights?: number | null;
  approvalRequired: boolean;
  activeFrom?: string | null;
  activeUntil?: string | null;
  blackouts: OwnerStayBlackout[];
  updatedAt?: string | null;
}

export interface OwnerStayRuleSummary {
  rule: OwnerStayRule;
  year: number;
  nightsUsed: number;
  nightsRemaining?: number | null;
}

export interface OwnerStayRequestBody {
  propertyId: string;
  startDate: string;
  endDate: string;
}

type OwnerDocumentType = 'Mandate' | 'Contract' | 'Insurance' | 'Statement' | 'Invoice' | 'Other';

export type OwnerDocumentVersionState = 'upcoming' | 'current' | 'superseded' | 'expired';

export type OwnerDocumentExpiryState = 'none' | 'valid' | 'expiring' | 'expired';

export interface OwnerDocumentVersion {
  id: string;
  versionNumber: number;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  sha256: string;
  effectiveFrom?: string | null;
  expiresOn?: string | null;
  state: OwnerDocumentVersionState;
  uploadedAt: string;
}

export interface OwnerDocument {
  id: string;
  orgId: string;
  propertyOwnerId: string;
  propertyId?: string | null;
  propertyName?: string | null;
  type: OwnerDocumentType;
  title: string;
  expiryState: OwnerDocumentExpiryState;
  expiresOn?: string | null;
  versions: OwnerDocumentVersion[];
  updatedAt: string;
}

type OwnerStatementVersionState = 'Draft' | 'Flagged' | 'Approved' | 'Published' | 'Superseded';

export interface OwnerStatementReference {
  statementVersionId: string;
  orgId: string;
  propertyOwnerId: string;
  periodYear: number;
  periodMonth: number;
  versionNumber: number;
  status: OwnerStatementVersionState;
  publishedAt: string;
  publishedSha256?: string | null;
}

export interface OwnerPortalDocuments {
  documents: OwnerDocument[];
  statements: OwnerStatementReference[];
}

export interface OwnerPortalExternalDocument {
  id: string;
  statementVersionId: string;
  externalNumber: string;
  externalDate: string;
  documentUrl?: string | null;
  documentSha256?: string | null;
  status: OwnerExternalDocumentStatus;
}

export type OwnerContactStatus = 'invited' | 'expired' | 'active' | 'revoked';

export interface OwnerContact {
  id: string;
  orgId: string;
  propertyOwnerId: string;
  email: string;
  firstName: string;
  lastName: string;
  permissions: OwnerPortalPermission[];
  status: OwnerContactStatus;
  createdAt: string;
  invitationExpiresAt: string;
  acceptedAt?: string | null;
  revokedAt?: string | null;
}

export interface InviteOwnerContactBody {
  agencyId?: string;
  email: string;
  firstName: string;
  lastName: string;
  permissions: OwnerPortalPermission[];
}

export interface OwnerContactAccepted {
  ownerUserId: string;
  agencyIds: string[];
  propertyIds: string[];
  alreadyAccepted: boolean;
  claimsRefresh: string;
}

type OwnerConversationTopic = 'General' | 'Property' | 'OwnerStay' | 'Document' | 'StatementVersion';

export type OwnerConversationTopicCode = 'general' | 'property' | 'ownerStay' | 'document' | 'statementVersion';

type OwnerMessageSender = 'Agency' | 'Owner';

export interface OwnerConversation {
  id: string;
  orgId: string;
  propertyOwnerId: string;
  topic: OwnerConversationTopic;
  propertyId?: string | null;
  ownerStayId?: string | null;
  documentId?: string | null;
  statementVersionId?: string | null;
  subject: string;
  createdAt: string;
  lastMessageAt: string;
}

interface OwnerMessageAttachment {
  fileName: string;
  contentType: string;
  sizeBytes: number;
}

export interface OwnerMessage {
  id: string;
  conversationId: string;
  sender: OwnerMessageSender;
  authorName: string;
  body: string;
  attachment?: OwnerMessageAttachment | null;
  createdAt: string;
}

export interface StartOwnerConversationBody {
  agencyId?: string;
  topic: OwnerConversationTopicCode;
  propertyId?: string;
  ownerStayId?: string;
  documentId?: string;
  statementVersionId?: string;
  subject: string;
  body: string;
}

export interface OwnerInboxPreferences {
  emailNotifications: boolean;
}
