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
  'StipulaDeclared',
  'QuesturaCommunicationMarkedDone',
  'PropertyDeliveryDateDeclared',
] as const;

export type LeaseEventType = (typeof LEASE_EVENT_TYPES)[number];

/**
 * Legacy combined value (contract type + tax regime) still returned by the API; the lease form sends `contractType` and
 * `taxRegime` (LT-10, A7-13).
 */
export type FiscalRegime = 'CedolareSecca' | 'RegimeOrdinario' | 'CanoneConcordato';

/** Contract type (backend `LeaseContractType`): libero 4+4, concordato 3+2, transitorio 1-18 months. */
export const LEASE_CONTRACT_TYPES = ['Libero', 'Concordato', 'Transitorio'] as const;
export type LeaseContractType = (typeof LEASE_CONTRACT_TYPES)[number];

/** Tax regime chosen by the landlord (backend `LeaseTaxRegime`), independent of the contract type. */
export const LEASE_TAX_REGIMES = ['CedolareSecca', 'Ordinario'] as const;
export type LeaseTaxRegime = (typeof LEASE_TAX_REGIMES)[number];

export type DataCompleteness = 'Complete' | 'Partial' | 'Missing';

/**
 * Characteristics of the unit for the canone concordato range (LT-10). No year count: the backend computes the term from
 * the lease dates.
 */
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
  contractType: LeaseContractType;
  /** Null only for canone concordato leases created before LT-10 (the old value did not say it). */
  taxRegime: LeaseTaxRegime | null;
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
  contractType: LeaseContractType;
  /** Null only for canone concordato leases created before LT-10 (the old value did not say it). */
  taxRegime: LeaseTaxRegime | null;
  startDate: string;
  endDate: string;
  monthlyRent: number;
  securityDeposit: number | null;
  /** Canone concordato leases only. */
  concordatoAssessment: LeaseConcordatoAssessment | null;
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

/**
 * `POST /leases` (LT-10): contract type and tax regime, the dates (the backend derives the term), the deposit and, for a
 * canone concordato lease, the characteristics the backend computes and checks the range with.
 */
export interface CreateLeaseDto {
  propertyId: string;
  contractType: LeaseContractType;
  taxRegime: LeaseTaxRegime;
  startDate: string;
  endDate: string;
  monthlyRent: number;
  securityDeposit?: number | null;
  parties: CreateLeasePartyDto[];
  canoneConcordato?: ConcordatoCharacteristics;
}

/**
 * How a party signs the contract (LT-02): `Offline` on paper or with the party's own digital signature, recorded when the
 * landlord uploads the signed PDF; `Provider` through the e-signature provider, with a personal link.
 */
export type LeaseSignatureMethod = 'Offline' | 'Provider';

export type LeaseSignerStatus = 'Pending' | 'Signed';

/** A party as signer, persisted by the API (A7-16): the provider link survives a page refresh. */
export interface LeaseSigner {
  partyId: string;
  role: PartyRole;
  firstName: string;
  lastName: string;
  method: LeaseSignatureMethod;
  status: LeaseSignerStatus;
  /** Provider link, only while pending and only for a caller who may sign the lease. */
  signingUrl: string | null;
  signingUrlExpiresAt: string | null;
  /** Computed by the API at read time. */
  signingUrlExpired: boolean;
  /** Provider signature instant, or the declared stipula date for an offline signature. */
  signedAt: string | null;
}

/** `GET /leases/:id/signers`: the signature panel. */
export interface LeaseSigningState {
  /** The e-signature provider path exists (backend flag `ESignProvider` on and a configured provider). */
  providerSigningAvailable: boolean;
  /** The final contract to sign can be downloaded now (approved template, complete data, not signed yet). */
  contractAvailable: boolean;
  /** Why it cannot: `contract_template_not_approved`, `contract_data_missing`, `lease_already_signed`. */
  contractUnavailableCode: string | null;
  signers: LeaseSigner[];
}

/** `POST /leases/:id/signed-document` (multipart): the contract signed by every party and the stipula date. */
export interface OfflineSignatureInput {
  /** `YYYY-MM-DD`: the day the last party signed, not later than today in Europe/Rome. */
  stipulaDate: string;
  signedContract: File;
}

/** `POST /leases/:id/signing` (provider path only). */
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

/** ATA status of the property's comune (backend `HighTensionAreaStatus`): only `Verified` grants the concordato reliefs. */
export type HighTensionAreaStatus = 'NotListed' | 'Unverified' | 'Verified';

/** `Computed`, or `InputRequired` (data CasaZen does not hold), or `NotComputed` (left to the accountant). */
export type AdvisoryEstimateStatus = 'Computed' | 'InputRequired' | 'NotComputed';

/**
 * `GET|POST /leases/:id/rli/advisory` (LT-08): cedolare secca against the ordinary regime. Figures come from the
 * configured parameters; what the backend cannot compute has a status, never an invented amount.
 */
export interface CedolareAdvisory {
  leaseRegime: FiscalRegime;
  contractType: LeaseContractType;
  /** Regime chosen by the landlord; null for older canone concordato leases. */
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
      /** False when the lines were not given: the amount counts the pages only. */
      linesConsidered: boolean;
      source: string;
    };
    irpef: {
      status: AdvisoryEstimateStatus;
      /** `not_configured`, `brackets_outdated`, `income_over_limit`, `concordato_ata_relief_not_verified`. */
      reasonCode: string | null;
      taxYear: number | null;
      rentFlatReduction: number | null;
      taxableRentEur: number | null;
      additionalGrossIrpefEur: number | null;
      source: string | null;
    };
  };
  /** Note codes, localized under `leases.rli.advisory.note`. */
  notes: string[];
}

/** Data of the advisory the backend does not hold: never stored, sent in the body of a POST. */
export interface CedolareAdvisoryInput {
  writtenPages?: number;
  lines?: number;
  copies?: number;
  otherTaxableIncomeEur?: number;
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
  /** Questura communication for an extra-EU tenant (LT-07); null or absent when no tenant is extra-EU. */
  questura?: QuesturaCommunicationStatus | null;
}

/**
 * Communication to the public-security authority for an extra-EU tenant (art. 7 D.Lgs. 286/1998, LT-07): within 48
 * hours of the delivery of the property. Dates are date-only values (UTC midnight of the Rome date).
 */
export interface QuesturaCommunicationStatus {
  /** Delivery of the property: the declared date, or the start date of the lease when none was declared. */
  deliveryDate: string;
  /** False while `deliveryDate` is the start date used by default. */
  deliveryDateDeclared: boolean;
  /** The day the 48 hours from the delivery end at the latest (delivery + 2 days). */
  deadline: string;
  /** Days to `deadline` on the Rome calendar: 0 on that day, negative once passed. */
  daysRemaining: number;
  /** Date of the communication declared by the landlord; null until the explicit declaration. */
  communicationDate: string | null;
  /** A receipt was uploaded with the declaration (download through the API). */
  hasReceipt: boolean;
}

/** `POST /leases/:id/rli/questura/mark-done` (multipart): the date it was sent and, optionally, the receipt PDF. */
export interface QuesturaCommunicationInput {
  /** `YYYY-MM-DD`, not later than today in Europe/Rome. */
  communicationDate: string;
  receipt?: File | null;
}

export interface TriggerRegistrationRequest {
  tosVersion: string;
  attestationAccepted: boolean;
}
