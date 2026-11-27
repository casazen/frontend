import type { LeaseOrigin } from './lease-draft.types';

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
  'StipulaDeclared',
  'QuesturaCommunicationMarkedDone',
  'PropertyDeliveryDateDeclared',
  'ReviewConfirmed',
  'ReviewReopened',
  'CondominiumExpenseChosen',
  'SentForSignature',
  'SentRevoked',
  'Imported',
  'NoticeRecorded',
  'NoticeRemoved',
  'Terminated',
  'TermRenewed',
  'ConcordatoFacileAdminAccess',
  'ConcordatoFacileGiftConsumed',
  'ConcordatoFacileLinkGenerated',
  'ConcordatoFacilePrivacyAccepted',
  'WithdrawalRecorded',
  'LetterSent',
  'RenewalRecorded',
  'DepositReturnRecorded',
] as const;

export type LeaseEventType = (typeof LEASE_EVENT_TYPES)[number];

type FiscalRegime = 'CedolareSecca' | 'RegimeOrdinario' | 'CanoneConcordato';

export const LEASE_CONTRACT_TYPES = ['Libero', 'Concordato', 'Transitorio'] as const;
export type LeaseContractType = (typeof LEASE_CONTRACT_TYPES)[number];

export const LEASE_TAX_REGIMES = ['CedolareSecca', 'Ordinario'] as const;
export type LeaseTaxRegime = (typeof LEASE_TAX_REGIMES)[number];

export type DataCompleteness = 'Complete' | 'Partial' | 'Missing';

export interface ConcordatoCharacteristics {
  sqm: number;
  garageSqm: number;
  balconySqm: number;
  otherAppurtenanceSqm: number;
  privateGreenSqm: number;
  typeAElementCount: number;
  typeBElementCount: number;
  typeCElementCount: number;
  typeDElementCount: number;
  qualifyingTypeDElementCount: number;
  stoveHeating: boolean;
  isFurnished: boolean;
  airConditioning: boolean;
  zoneName?: string | null;
  cadastralSheet?: string | null;
}

/**
 * Canone concordato data stored with a lease: the declared characteristics and the range the backend computed at
 * creation. `indicative`: the agreement data are not confirmed (Partial), the range is a guide and did not block the
 * lease (A7-23); `rentWithinRange` false is then a warning.
 */
export interface LeaseConcordatoAssessment extends ConcordatoCharacteristics {
  contractYears: number;
  usableSqm: number;
  zone: string;
  subFascia: number;
  canoneMinAnnuo: number;
  canoneMaxAnnuo: number;
  canoneMinMensile: number;
  canoneMaxMensile: number;
  dataCompleteness: DataCompleteness;
  indicative: boolean;
  rentWithinRange: boolean;
  calculatedAt: string;
}

export type PartyRole = 'Landlord' | 'Tenant';

type RegistrationStatus = 'Pending' | 'SentToProvider' | 'Registered' | 'Failed';

type RegistrationChannel = 'Manual' | 'Provider';

/**
 * A party as returned by the lease detail API: fiscal code and email arrive already masked from the
 * server (GDPR, A7-17); the clear values never reach the browser.
 */
interface LeaseParty {
  id: string;
  role: PartyRole;
  firstName: string;
  lastName: string;
  fiscalCodeMasked: string;
  contactEmailMasked: string;
  contactPhoneMasked?: string;
  isExtraEU: boolean;
  documentsVerifiedOn?: string | null;
  hasResidence?: boolean;
}

export interface LeaseEvent {
  /** A `LeaseEventType`; typed as string because a newer backend may add values. */
  eventType: string;
  occurredAt: string;
}

export interface LeaseRegistration {
  status: RegistrationStatus;
  channel: RegistrationChannel;
  registrationCode?: string | null;
  registrationDate?: string | null;
  submittedAt?: string | null;
  confirmedAt?: string | null;
  failureCode?: string | null;
  hasReceipt: boolean;
}

export type ManualRegistrationInput = {
  registrationCode: string;
  registrationDate: string;
} & ({ receipt: File } | { receiptDocumentId: string });

interface LeasePropertySummary {
  id: string;
  name: string;
  city?: string;
}

export const LEASE_LIST_VIEWS = ['All', 'Active', 'InPreparation', 'Expiring', 'Ended'] as const;
export type LeaseListView = (typeof LEASE_LIST_VIEWS)[number];

/**
 * Row of `GET /leases`: of the parties only their number and the name of the first tenant, never the fiscal code or the
 * e-mail. The tenant and rent fields are those of LR-01; they are optional here because an older answer lacks them.
 */
export interface LeaseSummary {
  id: string;
  propertyId: string;
  property?: LeasePropertySummary | null;
  status: LeaseStatus;
  fiscalRegime: FiscalRegime;
  contractType: LeaseContractType;
  taxRegime: LeaseTaxRegime | null;
  startDate: string;
  endDate: string;
  monthlyRent: number;
  stipulaDate: string | null;
  registrationDeadline: string | null;
  partyCount: number;
  hasExtraEUTenant: boolean;
  createdAt: string;
  updatedAt: string;
  tenantFirstName?: string | null;
  tenantLastName?: string | null;
  tenantAnonymized?: boolean;
  nextRentDueDate?: string | null;
  /** Installments past due, what they add up to and the days since the oldest was due: 0 / 0 / null when none is. */
  overdueRentCount?: number;
  overdueRentAmount?: number;
  overdueDays?: number | null;
  stage?: LeaseStage;
  nextStep?: LeaseNextStep | null;
  progress?: LeaseProgress | null;
  currentTermEndDate?: string;
}

type LeaseProgressKind = 'Setup' | 'Term' | 'End';

type LeaseProgressUnit = 'Steps' | 'Months' | 'Years';

export interface LeaseProgress {
  kind: LeaseProgressKind;
  unit: LeaseProgressUnit;
  done: number;
  total: number;
  percent: number;
}

export type LeaseStage =
  | 'Draft'
  | 'DataPending'
  | 'InReview'
  | 'SentForSignature'
  | 'Signed'
  | 'Active'
  | 'Expiring'
  | 'Concluded';

export type LeaseNextStepActor = 'Landlord' | 'Tenant' | 'System';

export type LeaseNextStepCode =
  | 'ChooseProperty'
  | 'CompleteStep'
  | 'ImportSignedContract'
  | 'AwaitPartnerContract'
  | 'ConfirmReview'
  | 'DownloadForSignature'
  | 'UploadSignedCopy'
  | 'RegisterLease'
  | 'RecordKeyHandover'
  | 'QuesturaCommunication'
  | 'SendRentReminder'
  | 'ActivateRentPlan'
  | 'DecideNotice'
  | 'OrganizeEnd'
  | 'AllGood'
  | 'Archive';

/**
 * The step a lease waits for. `priority` goes from 0 (the most urgent) to 10; `dueOn` is a Europe/Rome day; `params` carry what a
 * sentence needs (counts, amounts, days and codes, never a name). `code` is typed as string because a newer backend may add values.
 */
export interface LeaseNextStep {
  code: string;
  actor: LeaseNextStepActor;
  priority: number;
  dueOn?: string | null;
  params?: Record<string, unknown> | null;
}

export type LeaseNoticeParty = 'Landlord' | 'Tenant';

export interface LeaseDetail {
  id: string;
  propertyId: string;
  property?: LeasePropertySummary | null;
  status: LeaseStatus;
  fiscalRegime: FiscalRegime;
  contractType: LeaseContractType;
  taxRegime: LeaseTaxRegime | null;
  startDate: string;
  endDate: string;
  monthlyRent: number;
  securityDeposit: number | null;
  concordatoAssessment: LeaseConcordatoAssessment | null;
  stipulaDate: string | null;
  registrationDeadline: string | null;
  hasSignedPdf: boolean;
  hasExtraEUTenant: boolean;
  origin?: LeaseOrigin;
  isConcordatoFacileSource?: boolean;
  parties: LeaseParty[];
  registration?: LeaseRegistration | null;
  events: LeaseEvent[];
  createdAt: string;
  updatedAt: string;
  sentForSignatureAt?: string | null;
  currentTermEndDate?: string;
  noticeOn?: string | null;
  noticeFrom?: LeaseNoticeParty | null;
  /** LR-14: the last day of a lease ended early (or recorded as concluded when it was already over); null otherwise. */
  terminatedOn?: string | null;
  renewalMonths?: number;
  noticeWarning?: string | null;
}

export interface CfDraftResponse {
  id: string;
  propertyId: string;
  status: LeaseStatus;
}

export const LEASE_DRAFT_PLACEHOLDER_DATE = '3000-01-01';

type LeaseSignatureMethod = 'Offline' | 'Provider';

type LeaseSignerStatus = 'Pending' | 'Signed';

export interface LeaseSigner {
  partyId: string;
  role: PartyRole;
  firstName: string;
  lastName: string;
  method: LeaseSignatureMethod;
  status: LeaseSignerStatus;
  signingUrl: string | null;
  signingUrlExpiresAt: string | null;
  signingUrlExpired: boolean;
  signedAt: string | null;
}

export interface LeaseSigningState {
  providerSigningAvailable: boolean;
  contractAvailable: boolean;
  contractUnavailableCode: string | null;
  signers: LeaseSigner[];
}

export interface OfflineSignatureInput {
  stipulaDate: string;
  signedContract: File;
}

export interface SigningInitiatedResult {
  leaseId: string;
  status: LeaseStatus;
  signers: LeaseSigner[];
}

export interface TriggerRegistrationResult {
  leaseId: string;
  registrationStatus: RegistrationStatus;
  message: string;
}

export type HighTensionAreaStatus = 'NotListed' | 'Unverified' | 'Verified';

type AdvisoryEstimateStatus = 'Computed' | 'InputRequired' | 'NotComputed';

/**
 * `GET|POST /leases/:id/rli/advisory` (LT-08): cedolare secca against the ordinary regime. Figures come from the
 * configured parameters; what the backend cannot compute has a status, never an invented amount.
 */
export interface CedolareAdvisory {
  leaseRegime: FiscalRegime;
  contractType: LeaseContractType;
  taxRegime: LeaseTaxRegime | null;
  annualRent: number;
  ata: HighTensionAreaStatus;
  /** Canone concordato in a verified ATA comune: reduced cedolare rate and 70% registration base. */
  concordatoAtaReliefs: boolean;
  cedolare: {
    rate: number;
    rateBasis: 'Standard' | 'ConcordatoAta';
    annualTaxEur: number;
    /** Always 0: no registration tax nor stamp duty with the cedolare. */
    registroEur: number;
    bolloEur: number;
    source: string;
  };
  ordinary: {
    registro: {
      rate: number;
      baseShare: number;
      taxableBaseEur: number;
      computedEur: number;
      firstYearMinimumEur: number;
      minimumApplied: boolean;
      firstYearEur: number;
      source: string;
    };
    bollo: {
      status: AdvisoryEstimateStatus;
      eurPerUnit: number;
      pagesPerUnit: number;
      linesPerUnit: number;
      units: number | null;
      copies: number | null;
      amountEur: number | null;
      linesConsidered: boolean;
      source: string;
    };
    irpef: {
      status: AdvisoryEstimateStatus;
      reasonCode: string | null;
      taxYear: number | null;
      rentFlatReduction: number | null;
      taxableRentEur: number | null;
      additionalGrossIrpefEur: number | null;
      source: string | null;
    };
  };
  notes: string[];
}

export interface CedolareAdvisoryInput {
  writtenPages?: number;
  lines?: number;
  copies?: number;
  otherTaxableIncomeEur?: number;
}

export interface RliChecklistItem {
  key: string;
  label: string;
  done: boolean;
  failed?: boolean;
}

export interface RliChecklist {
  registrationDeadline: string | null;
  daysRemaining: number | null;
  tosVersion: string;
  attestationText: string;
  /** Provider filing exists (backend flag `RliProvider` on and a configured provider); otherwise manual only. */
  providerFilingAvailable: boolean;
  items: RliChecklistItem[];
  /** Questura communication for an extra-EU tenant (LT-07); null or absent when no tenant is extra-EU. */
  questura?: QuesturaCommunicationStatus | null;
}

/**
 * Communication to the public-security authority for an extra-EU tenant (art. 7 D.Lgs. 286/1998, LT-07): within 48
 * hours of the delivery of the property. Dates are date-only values (UTC midnight of the Rome date).
 */
export interface QuesturaCommunicationStatus {
  deliveryDate: string;
  deliveryDateDeclared: boolean;
  deadline: string;
  daysRemaining: number;
  communicationDate: string | null;
  hasReceipt: boolean;
}

/** `POST /leases/:id/rli/questura/mark-done` (multipart): the date it was sent and, optionally, the receipt PDF. */
export interface QuesturaCommunicationInput {
  communicationDate: string;
  receipt?: File | null;
}
