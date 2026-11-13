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

/** Where the portal invitation of an owner stands (`OwnerPortalStates`): `notReady` comes before `ready`. */
export const OWNER_PORTAL_STATES = ['notReady', 'ready', 'invited', 'accepted', 'expired', 'revoked'] as const;
export type OwnerPortalState = (typeof OWNER_PORTAL_STATES)[number];

/** One error of a row of the owner file: the column it is about and the code of the error (never a value). */
export interface OwnerImportRowError {
  column: string;
  code: string;
}

/** An owner an ambiguous row could be: its id, its key and the name the agency keeps for it. */
export interface OwnerImportCandidate {
  ownerId: string;
  externalKey: string | null;
  displayName: string;
}

/** What the import would do, or did, with the owner of a row. */
export type OwnerImportOwnerAction = 'create_owner' | 'match_owner' | 'conflict';

/** What the import would do, or did, with the ownership of a row; `null` when the row cannot be judged. */
export type OwnerImportOwnershipAction = 'create_ownership' | 'update_future_period' | 'unchanged' | 'conflict';

/** One row of the owner file: `status` is `ok` or the code of its first error. */
export interface OwnerImportRow {
  /** The row as the person sees it in the sheet: the header is row 1. */
  rowNumber: number;
  propertyRef: string | null;
  propertyId: string | null;
  ownerKey: string | null;
  ownerId: string | null;
  /** How an existing owner was found (`owner_id`, `external_key`, `fiscal_identifier`): never by e-mail. */
  matchedBy: string | null;
  status: string;
  errors: OwnerImportRowError[];
  ownerAction: OwnerImportOwnerAction | null;
  ownershipAction: OwnerImportOwnershipAction | null;
  candidates: OwnerImportCandidate[];
  applied: boolean;
}

export interface OwnerImportSummary {
  rows: number;
  valid: number;
  invalid: number;
  applied: number;
  ownersToCreate: number;
  ownersMatched: number;
  ownershipsToCreate: number;
  periodsToUpdate: number;
}

/** The days where the shares of a property would be wrong after the file. */
export interface OwnerImportPropertyIssue {
  propertyId: string;
  issues: OwnershipIssue[];
}

/** `POST api/onboarding/owners/import?dryRun=`: the same shape for the check and for the import. It never sends an invitation. */
export interface OwnerImportResult {
  dryRun: boolean;
  fingerprint: string;
  summary: OwnerImportSummary;
  unknownColumns: string[];
  rows: OwnerImportRow[];
  propertyIssues: OwnerImportPropertyIssue[];
}

/** How many owners are ready and how many are to complete, for one dimension. */
export interface OwnerReadinessCount {
  ready: number;
  toComplete: number;
}

/** The counts of the readiness (always complete, whatever the lists are cut at). */
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
  /** True only when the owner accounting can start; it never blocks, and is never blocked by, the OTA readiness. */
  financialReady: boolean;
}

/** For which of the six dimensions an owner is ready. */
export interface OwnerReadinessFlags {
  registry: boolean;
  ownership: boolean;
  mandate: boolean;
  fiscalProfile: boolean;
  payment: boolean;
  portal: boolean;
}

/** One owner of the readiness: its name in the agency's registry, where it is ready and every fact that is missing (codes and field names). */
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

/** `GET api/onboarding/owners/readiness`: what is missing for the owner accounting and for the portal. Separate from the OTA readiness. */
export interface OwnerReadinessReport {
  asOf: string;
  summary: OwnerReadinessSummary;
  owners: OwnerReadinessOwner[];
  properties: OwnerOnboardingProperty[];
  /** A list was cut at the limit of the server; the counts of the summary are complete. */
  truncated: boolean;
}

/** An owner and where its invitation stands (`GET api/onboarding/owners/invitations`). No address, no link, no token. */
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

/** An owner the batch would invite, with the address the link would go to (shown to who manages the owners, in the preview only). */
export interface OwnerInvitationRecipient {
  ownerId: string;
  displayName: string;
  email: string;
  portalState: OwnerPortalState;
}

/** An owner the batch leaves out, and the codes that say why. */
export interface OwnerInvitationExclusion {
  ownerId: string;
  displayName: string | null;
  reasons: string[];
}

/** The limit of the day: at most `limit` invitations for each org in 24 hours. */
export interface OwnerInvitationQuota {
  limit: number;
  used: number;
  remaining: number;
}

/** `POST api/onboarding/owners/invitations/preview`: the batch that confirming would send. Nothing is sent by asking. */
export interface OwnerInvitationPreview {
  fingerprint: string;
  recipients: OwnerInvitationRecipient[];
  exclusions: OwnerInvitationExclusion[];
  quota: OwnerInvitationQuota;
}

/** Body of the preview and of the confirmation: the owners chosen (never empty: an empty list is refused, it never means «all») and, to confirm, the fingerprint of the preview. */
export interface OwnerInvitationBatchRequest {
  ownerIds: string[];
  fingerprint?: string;
}

/** `POST api/onboarding/owners/invitations/confirm`: the invitations sent, and the owners whose e-mail could not be queued. */
export interface OwnerInvitationBatchResult {
  sent: number;
  invitations: { invitationId: string; ownerId: string; expiresAt: string }[];
  failed: { ownerId: string; code: string }[];
}

/** How the claims of the owner portal reached the identity provider (`claimsRefresh` of the acceptance). */
export type OwnerClaimsRefresh = 'published' | 'not_configured' | 'failed';

/** `POST api/owner-invitations/accept`: the owner is now the account's. Ids only. */
export interface OwnerInvitationAccepted {
  ownerUserId: string;
  agencyIds: string[];
  ownedPropertyIds: string[];
  alreadyAccepted: boolean;
  claimsRefresh: OwnerClaimsRefresh | string;
}
