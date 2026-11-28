export type LeaseOrigin = 'Created' | 'Imported';

type LeaseStepState = 'Done' | 'Todo' | 'Waiting' | 'Locked' | 'NotApplicable';

export interface LeaseNeed {
  code: string;
  params?: Record<string, unknown> | null;
}

export interface LeaseFlowStep {
  step: number;
  state: LeaseStepState;
  needs: LeaseNeed[];
}

/**
 * Another lease of the same property that covers some of the same days (backend LR-OVERLAP): its id and the first and last day it
 * covers (`yyyy-MM-dd`). Never the name of a person. The same three members are in the review check `lease_overlap` and in the 409
 * `lease_period_overlaps` of the steps that make a lease a contract.
 */
export interface LeasePeriodConflict {
  conflictingLeaseId: string;
  conflictingFrom: string;
  conflictingTo: string;
}

export interface LeaseDraftFlow {
  steps: LeaseFlowStep[];
  /** Set once the property and both dates are there and another lease has some of the same days: the soft warning of the wizard. */
  periodConflict?: LeasePeriodConflict | null;
}

export interface LeaseDraftParty {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  fiscalCode?: string | null;
  citizenship?: string | null;
  residence?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
}

export interface LeaseDraftValues {
  propertyId?: string | null;
  landlords: LeaseDraftParty[];
  tenants: LeaseDraftParty[];
  contractType?: string | null;
  taxRegime?: string | null;
  monthlyRent?: number | null;
  securityDeposit?: number | null;
  transitoryParty?: string | null;
  transitoryNeed?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  transitoryDocumentation?: string | null;
}

export interface LeaseDraft {
  id: string;
  version: number;
  origin: LeaseOrigin;
  wizardMaxStep: number;
  reviewConfirmedAt: string | null;
  sentForSignatureAt: string | null;
  updatedAt: string;
  values: LeaseDraftValues;
  flow: LeaseDraftFlow;
}

export interface LeaseDraftCreated {
  id: string;
  version: number;
  flow: LeaseDraftFlow;
}

export interface LeaseDraftSaved {
  version: number;
  flow: LeaseDraftFlow;
  landlordIds: string[];
  tenantIds: string[];
}

export type LeaseReviewSeverity = 'Block' | 'Warn' | 'Info' | 'Ok';

export interface LeaseReviewCheck {
  code: string;
  severity: LeaseReviewSeverity;
  step: number;
  params?: Record<string, unknown> | null;
}

export interface LeaseReview {
  version: number;
  reviewConfirmedAt: string | null;
  checks: LeaseReviewCheck[];
  counts: { block: number; warn: number; info: number; ok: number };
}

export interface LeaseReviewConfirmation {
  version: number;
  reviewConfirmedAt: string | null;
  flow: LeaseDraftFlow;
}

export interface LeaseSent {
  version: number;
  sentForSignatureAt: string | null;
  flow: LeaseDraftFlow;
}

export interface LongRentRules {
  termMonths: Record<string, number>;
  renewalMonths: Record<string, number>;
  noticeMonths: number;
  registrationDays: number;
  depositMaxRents: number;
  /** Types that can be made in CasaZen (the transitory one too, with the official model, since TR). */
  availableTypes: string[];
  importedTypes: string[];
  transitoryTermMonths: { min: number; max: number };
  transitoryDocumentationAfterDays: number;
  transitoryBandFromInhabitants: number;
}

type LeaseReadingState = 'None' | 'Reading' | 'Done' | 'Failed';

type LeaseReadingFieldState = 'Read' | 'Agrees' | 'Conflict' | 'Unusable';

export interface LeaseReadingField {
  field: string;
  partyId: string | null;
  role: string | null;
  state: LeaseReadingFieldState;
  confidence: number;
  derived: boolean;
}

type LeaseDocumentSectionKind = 'contract' | 'attestation' | 'calculationSheet';

export interface LeaseDocumentSection {
  kind: LeaseDocumentSectionKind;
  firstPage: number;
  lastPage: number;
}

export interface LeaseReadingWarning {
  code: string;
  pages: number[] | null;
}

export interface LeaseReadingDocument {
  id: string;
  fileName: string;
  status: 'NotStarted' | 'Processing' | 'Completed' | 'NeedsReview' | 'Failed' | 'Skipped';
  error: string | null;
  sections?: LeaseDocumentSection[] | null;
  containsAttestation?: boolean;
  containsCalculationSheet?: boolean;
  warnings?: LeaseReadingWarning[] | null;
}

export interface LeaseReading {
  state: LeaseReadingState;
  documents: LeaseReadingDocument[];
  fields: LeaseReadingField[];
  stipulaDate: string | null;
  /** The contract document the final import can use instead of a file sent again. */
  contractDocumentId: string | null;
}

export type ImportSignedInput = { stipulaDate: string } & ({ signedContract: File } | { contractDocumentId: string });

export interface LandlordDefaults {
  firstName: string | null;
  lastName: string | null;
  fiscalCode: string | null;
  residence: string | null;
  contactEmail: string | null;
}
