import type { OwnerOnboardingProperty, OwnerOnboardingReason, OwnershipIssue } from './owner-accounting.types';

/**
 * The owner portfolio in the onboarding of an agency (E10/F02/US02, NF-109), field for field as the backend answers it
 * (`Casazen.Web/DTOs/Onboarding/OwnerOnboardingDtos.cs` and `Casazen.Web/DTOs/OwnerInvitations/OwnerInvitationDtos.cs`), in camelCase.
 *
 * What these types never hold: a fiscal code, a VAT number, an IBAN or a BIC (the server answers codes, ids, counts and the names the
 * agency keeps in its registry), nothing of a guest and no token or link of an invitation. The server sends codes and the app turns them
 * into words (`ownerOnboarding.*`): a code this version does not know is possible at run time, whatever the union says, and a screen shows
 * a neutral line for it, never the bare code.
 */

export const OWNER_PORTAL_STATES = ['notReady', 'ready', 'invited', 'accepted', 'expired', 'revoked'] as const;
export type OwnerPortalState = (typeof OWNER_PORTAL_STATES)[number];

interface OwnerImportRowError {
  column: string;
  code: string;
}

interface OwnerImportCandidate {
  ownerId: string;
  externalKey: string | null;
  displayName: string;
}

type OwnerImportOwnerAction = 'create_owner' | 'match_owner' | 'conflict';

type OwnerImportOwnershipAction = 'create_ownership' | 'update_future_period' | 'unchanged' | 'conflict';

export interface OwnerImportRow {
  rowNumber: number;
  propertyRef: string | null;
  propertyId: string | null;
  ownerKey: string | null;
  ownerId: string | null;
  matchedBy: string | null;
  status: string;
  errors: OwnerImportRowError[];
  ownerAction: OwnerImportOwnerAction | null;
  ownershipAction: OwnerImportOwnershipAction | null;
  candidates: OwnerImportCandidate[];
  applied: boolean;
}

interface OwnerImportSummary {
  rows: number;
  valid: number;
  invalid: number;
  applied: number;
  ownersToCreate: number;
  ownersMatched: number;
  ownershipsToCreate: number;
  periodsToUpdate: number;
}

interface OwnerImportPropertyIssue {
  propertyId: string;
  issues: OwnershipIssue[];
}

export interface OwnerImportResult {
  dryRun: boolean;
  fingerprint: string;
  summary: OwnerImportSummary;
  unknownColumns: string[];
  rows: OwnerImportRow[];
  propertyIssues: OwnerImportPropertyIssue[];
}

interface OwnerReadinessCount {
  ready: number;
  toComplete: number;
}

export interface OwnerReadinessSummary {
  owners: number;
  properties: number;
  registry: OwnerReadinessCount;
  ownership: OwnerReadinessCount;
  mandate: OwnerReadinessCount;
  fiscalProfile: OwnerReadinessCount;
  payment: OwnerReadinessCount;
  portal: OwnerReadinessCount;
  accountingReadyOwners: number;
  propertiesWithoutOwner: number;
  propertiesToComplete: number;
  financialReady: boolean;
}

export interface OwnerReadinessFlags {
  registry: boolean;
  ownership: boolean;
  mandate: boolean;
  fiscalProfile: boolean;
  payment: boolean;
  portal: boolean;
}

export interface OwnerReadinessOwner {
  ownerId: string;
  externalKey: string | null;
  displayName: string;
  entityKind: string | null;
  ready: OwnerReadinessFlags;
  accountingReady: boolean;
  portalState: OwnerPortalState;
  reasons: OwnerOnboardingReason[];
}

export interface OwnerReadinessReport {
  asOf: string;
  summary: OwnerReadinessSummary;
  owners: OwnerReadinessOwner[];
  properties: OwnerOnboardingProperty[];
  truncated: boolean;
}

export interface OwnerInvitationStatus {
  ownerId: string;
  displayName: string;
  state: OwnerPortalState;
  invitationId: string | null;
  sentAt: string | null;
  expiresAt: string | null;
  acceptedAt: string | null;
  closedAt: string | null;
}

interface OwnerInvitationRecipient {
  ownerId: string;
  displayName: string;
  email: string;
  portalState: OwnerPortalState;
}

interface OwnerInvitationExclusion {
  ownerId: string;
  displayName: string | null;
  reasons: string[];
}

interface OwnerInvitationQuota {
  limit: number;
  used: number;
  remaining: number;
}

export interface OwnerInvitationPreview {
  fingerprint: string;
  recipients: OwnerInvitationRecipient[];
  exclusions: OwnerInvitationExclusion[];
  quota: OwnerInvitationQuota;
}

export interface OwnerInvitationBatchResult {
  sent: number;
  invitations: { invitationId: string; ownerId: string; expiresAt: string }[];
  failed: { ownerId: string; code: string }[];
}

type OwnerClaimsRefresh = 'published' | 'not_configured' | 'failed';

export interface OwnerInvitationAccepted {
  ownerUserId: string;
  agencyIds: string[];
  ownedPropertyIds: string[];
  alreadyAccepted: boolean;
  claimsRefresh: OwnerClaimsRefresh | string;
}
