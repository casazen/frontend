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

/** What a person of the portal may do for an owner profile (`calendar.read`, ...): the owner holds all of them, a contact the ones it was given. */
export type OwnerPortalPermission = 'calendar.read' | 'stays.request' | 'accounting.read' | 'documents.read' | 'inbox.use';

/** Every permission, in the order of the brief. */
export const OWNER_PORTAL_PERMISSIONS: readonly OwnerPortalPermission[] = [
  'calendar.read',
  'stays.request',
  'accounting.read',
  'documents.read',
  'inbox.use',
];

// ---------------------------------------------------------------- calendar and owner stays

/** The neutral kinds of the days of the owner calendar: no guest, no channel, no text. */
export type OwnerCalendarKind = 'available' | 'occupied' | 'blocked' | 'ownerStay';

/**
 * How an owner stay reads: `confirmed` only once its block is acknowledged, `approved_syncing` while it is not, `sync_failed` when the block was
 * refused (the agency sends it again): never «confirmed» before the block exists.
 */
export type OwnerStayState = 'requested' | 'approved_syncing' | 'confirmed' | 'sync_failed' | 'rejected' | 'cancelled';

/** Where an owner stay stands for the agency (`OwnerStayStatus`). */
export type OwnerStayStatus = 'Requested' | 'Approved' | 'Rejected' | 'Cancelled';

/** What the channels say of the block of a stay, or of its release (`OwnerStaySyncState`). */
export type OwnerStaySyncState = 'None' | 'Pending' | 'Acknowledged' | 'Failed';

/** A run of nights with the same kind: `start` included, `end` excluded. The stay id and state come only with `ownerStay`. */
export interface OwnerCalendarRange {
  start: string;
  end: string;
  kind: OwnerCalendarKind;
  stayId?: string | null;
  stayState?: OwnerStayState | null;
}

/** `GET api/owner-portal/calendar`: the nights from `from` to `to` (both included) cut to the ownerships of the caller. */
export interface OwnerCalendar {
  propertyId: string;
  from: string;
  to: string;
  ranges: OwnerCalendarRange[];
}

/** An owner stay as the portal reads it. No guest, no price. */
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
  /** A contact the owner delegated asked for it, not the owner. */
  requestedByContact: boolean;
}

/** Dates closed to owner stays: the nights from `from` to `to`, both included. */
export interface OwnerStayBlackout {
  from: string;
  to: string;
}

/** The rule an owner stay follows. */
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

/** `GET api/owner-portal/stays/rule`: the rule, with the nights the owner already holds in `year` (requested and approved). */
export interface OwnerStayRuleSummary {
  rule: OwnerStayRule;
  year: number;
  nightsUsed: number;
  /** What the allowance leaves this year; nothing without an allowance. */
  nightsRemaining?: number | null;
}

/** `POST api/owner-portal/stays`: the property, the arrival and the departure. */
export interface OwnerStayRequestBody {
  propertyId: string;
  startDate: string;
  endDate: string;
}

// ---------------------------------------------------------------- documents

export type OwnerDocumentType = 'Mandate' | 'Contract' | 'Insurance' | 'Statement' | 'Invoice' | 'Other';

/** How a version reads on a day: not in force yet, in force, a later one is in force, or lapsed. */
export type OwnerDocumentVersionState = 'upcoming' | 'current' | 'superseded' | 'expired';

/** The expiry of the current version: none, far, within 30 days, or past. */
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

/** A document the agency shares: its versions, the newest first, and the expiry state of the current one. */
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

/** The life of a version of an owner statement (E06). The portal shows `Published` and `Superseded` only. */
export type OwnerStatementVersionState = 'Draft' | 'Flagged' | 'Approved' | 'Published' | 'Superseded';

/** A published (or superseded) statement version of the owner accounting, referenced where it is (E06), never copied. */
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

/** `GET api/owner-portal/documents`: the documents the caller may read and the published statement versions. */
export interface OwnerPortalDocuments {
  documents: OwnerDocument[];
  statements: OwnerStatementReference[];
}

/**
 * `GET api/owner-portal/external-documents`: the link of an invoice the agency issued elsewhere, for a published statement version. Its `status` is the check
 * the agency made of the link (`Entered`, `Verified`): it says nothing of a payment or of a submission to the tax authority.
 */
export interface OwnerPortalExternalDocument {
  id: string;
  statementVersionId: string;
  externalNumber: string;
  externalDate: string;
  documentUrl?: string | null;
  documentSha256?: string | null;
  status: OwnerExternalDocumentStatus;
}

// ---------------------------------------------------------------- delegated contacts

/** `invited` (the link is not used yet), `expired` (it lapsed), `active` (it holds the permissions it was given), `revoked` (nothing). */
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

/** `POST api/owner-portal/contacts`: a contact with its own account and at least one permission (an empty list is never «all»). */
export interface InviteOwnerContactBody {
  /** Needed only when the owner has more than one agency. */
  agencyId?: string;
  email: string;
  firstName: string;
  lastName: string;
  permissions: OwnerPortalPermission[];
}

/** What the acceptance of the invitation of a contact did, and whether the claims of the portal reached the identity provider. */
export interface OwnerContactAccepted {
  ownerUserId: string;
  agencyIds: string[];
  propertyIds: string[];
  alreadyAccepted: boolean;
  claimsRefresh: string;
}

// ---------------------------------------------------------------- inbox

/** What a conversation is about. */
export type OwnerConversationTopic = 'General' | 'Property' | 'OwnerStay' | 'Document' | 'StatementVersion';

/** The topic as `POST api/owner-portal/conversations` reads it (case-insensitive on the server). */
export type OwnerConversationTopicCode = 'general' | 'property' | 'ownerStay' | 'document' | 'statementVersion';

export type OwnerMessageSender = 'Agency' | 'Owner';

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

export interface OwnerMessageAttachment {
  fileName: string;
  contentType: string;
  sizeBytes: number;
}

/** A message: who wrote it (the agency, or the person of the portal by name), the words and the file. */
export interface OwnerMessage {
  id: string;
  conversationId: string;
  sender: OwnerMessageSender;
  authorName: string;
  body: string;
  attachment?: OwnerMessageAttachment | null;
  createdAt: string;
}

/** `POST api/owner-portal/conversations`: exactly the reference the topic names, the subject and the first message. */
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

/** Whether the person of the portal gets an e-mail when the agency writes. */
export interface OwnerInboxPreferences {
  emailNotifications: boolean;
}
