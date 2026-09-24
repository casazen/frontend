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

/** How the RLI registration is made (LT-01): declared by the landlord, or filed by a provider. */
export type RegistrationChannel = 'Manual' | 'Provider';

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

/** RLI registration of a lease. The receipt is downloaded through the API only (`hasReceipt`). */
export interface LeaseRegistration {
  status: RegistrationStatus;
  channel: RegistrationChannel;
  /** Registration number or protocol of the Agenzia delle Entrate. */
  registrationCode?: string | null;
  /** Date of the registration (date-only, UTC midnight). */
  registrationDate?: string | null;
  submittedAt?: string | null;
  confirmedAt?: string | null;
  /** Stable code of the last failure (`provider_error`, `provider_rejected`...), only when `status` is Failed. */
  failureCode?: string | null;
  hasReceipt: boolean;
}

/** `POST /leases/:id/registration/manual` (multipart): what the landlord reads on the receipt, plus the PDF. */
export interface ManualRegistrationInput {
  registrationCode: string;
  /** `YYYY-MM-DD`, not later than today in Europe/Rome. */
  registrationDate: string;
  receipt: File;
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
  /** Day every party had signed (the stipula); null until then. */
  stipulaDate: string | null;
  /** RLI deadline: min(stipula, start) + 30 days; null while it is to be determined (LT-04). */
  registrationDeadline: string | null;
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
  /** Day every party had signed (the stipula); null until then. */
  stipulaDate: string | null;
  /** RLI deadline: min(stipula, start) + 30 days; null while it is to be determined (LT-04). */
  registrationDeadline: string | null;
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
  /** The step happened (the registration item only with the registration recorded and its receipt). */
  done: boolean;
  /** The last attempt of the step failed. */
  failed?: boolean;
}

export interface RliChecklist {
  /** Null while the deadline is to be determined (no stipula yet and start date ahead, or stipula not recorded). */
  registrationDeadline: string | null;
  /** Days to the deadline on the Rome calendar: 0 on the deadline day, negative after it; null with no deadline. */
  daysRemaining: number | null;
  tosVersion: string;
  attestationText: string;
  /** Provider filing exists (backend flag `RliProvider` on and a configured provider); otherwise manual only. */
  providerFilingAvailable: boolean;
  items: RliChecklistItem[];
}

export interface TriggerRegistrationRequest {
  tosVersion: string;
  attestationAccepted: boolean;
}
