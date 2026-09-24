/** Every value of the backend enum `Casazen.Core.Entities.Enums.LeaseStatus`, in order. */
export const LEASE_STATUSES = [
  'Draft',
  'AwaitingSignature',
  'PartiallySigned',
  'Signed',
  'RegistrationPending',
  'SentToProvider',
  'Registered',
  'Rejected',
] as const;

export type LeaseStatus = (typeof LEASE_STATUSES)[number];

/** Every value of the backend enum `Casazen.Core.Entities.Enums.LeaseEventType` (timeline entries). */
export const LEASE_EVENT_TYPES = [
  'Created',
  'SigningInitiated',
  'PartySignedDocument',
  'AllPartiesSigned',
  'RegistrationSubmitted',
  'RegistrationConfirmed',
  'RegistrationFailed',
  'ErasureRequested',
  'ImuNotificationExported',
  'ImuNotificationMarkedSent',
  'RegistrationAuthorized',
  'RliExported',
  'DeadlineReminderSent',
] as const;

export type LeaseEventType = (typeof LEASE_EVENT_TYPES)[number];

export type FiscalRegime = 'CedolareSecca' | 'RegimeOrdinario' | 'CanoneConcordato';

export type PartyRole = 'Landlord' | 'Tenant';

export type RegistrationStatus = 'Pending' | 'SentToProvider' | 'Registered' | 'Failed';

/**
 * A party as returned by the lease detail API: fiscal code and email arrive already masked from the
 * server (GDPR, A7-17); the clear values never reach the browser.
 */
export interface LeaseParty {
  id: string;
  role: PartyRole;
  firstName: string;
  lastName: string;
  fiscalCodeMasked: string;
  contactEmailMasked: string;
  isExtraEU: boolean;
}

export interface LeaseEvent {
  /** A `LeaseEventType`; typed as string because a newer backend may add values. */
  eventType: string;
  occurredAt: string;
}

export interface LeaseRegistration {
  status: RegistrationStatus;
  registrationCode?: string | null;
  submittedAt?: string | null;
  confirmedAt?: string | null;
}

export interface LeasePropertySummary {
  id: string;
  name: string;
  city?: string;
}

/** Row of `GET /leases`: no personal data of the parties, only their number. */
export interface LeaseSummary {
  id: string;
  propertyId: string;
  property?: LeasePropertySummary | null;
  status: LeaseStatus;
  fiscalRegime: FiscalRegime;
  startDate: string;
  endDate: string;
  monthlyRent: number;
  registrationDeadline: string;
  partyCount: number;
  hasExtraEUTenant: boolean;
  createdAt: string;
  updatedAt: string;
}

/** `GET /leases/:id` (and the `POST /leases` response). */
export interface LeaseDetail {
  id: string;
  propertyId: string;
  property?: LeasePropertySummary | null;
  status: LeaseStatus;
  fiscalRegime: FiscalRegime;
  startDate: string;
  endDate: string;
  monthlyRent: number;
  registrationDeadline: string;
  hasSignedPdf: boolean;
  hasExtraEUTenant: boolean;
  parties: LeaseParty[];
  registration?: LeaseRegistration | null;
  events: LeaseEvent[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateLeasePartyDto {
  role: PartyRole;
  firstName: string;
  lastName: string;
  fiscalCode: string;
  citizenship: string;
  contactEmail: string;
}

export interface CreateLeaseDto {
  propertyId: string;
  fiscalRegime: FiscalRegime;
  startDate: string;
  endDate: string;
  monthlyRent: number;
  parties: CreateLeasePartyDto[];
}

export interface SignerInfo {
  partyId: string;
  role: PartyRole;
  name: string;
  signingUrl: string;
  expiresAt: string;
}

export interface SigningInitiatedResult {
  leaseId: string;
  status: LeaseStatus;
  signers: SignerInfo[];
}

export interface TriggerRegistrationResult {
  leaseId: string;
  registrationStatus: RegistrationStatus;
  message: string;
}

export interface CedolareAdvisory {
  leaseRegime: FiscalRegime;
  annualRent: number;
  cedolareRate: number;
  cedolareEstimateEur: number;
  registroRate: number;
  registroEstimateEur: number;
  bolloEur: number;
  ordinaryIrpefNote: string;
  disclaimer: string;
}

export interface RliChecklistItem {
  key: string;
  label: string;
  done: boolean;
}

export interface RliChecklist {
  registrationDeadline: string;
  daysRemaining: number;
  tosVersion: string;
  attestationText: string;
  items: RliChecklistItem[];
}

export interface TriggerRegistrationRequest {
  tosVersion: string;
  attestationAccepted: boolean;
}
