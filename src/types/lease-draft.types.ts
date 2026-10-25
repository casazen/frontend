/**
 * The guided draft of a long-term lease (backend LR-12, LR-13): the draft lives on the server from its first step, every step is
 * saved there, and the server says what each step still needs (`flow`). Nothing here is kept in the browser.
 */

/** How the lease came to be: made in CasaZen, or a contract already signed elsewhere (`Imported`). Chosen once, never changed. */
export type LeaseOrigin = 'Created' | 'Imported';

/** State of a step of the wizard, decided by the server (`LeaseStepState`). `Waiting` is never produced in the first release. */
export type LeaseStepState = 'Done' | 'Todo' | 'Waiting' | 'Locked' | 'NotApplicable';

/** One thing missing in a step, or one thing to know: a stable code (a closed list on the server) and its parameters. */
export interface LeaseNeed {
  code: string;
  params?: Record<string, unknown> | null;
}

export interface LeaseFlowStep {
  /** 1 to 8: Immobile, Parti, Condizioni, Durata e date, Modello, Revisione, Firma, Dopo la firma. */
  step: number;
  state: LeaseStepState;
  needs: LeaseNeed[];
}

export interface LeaseDraftFlow {
  steps: LeaseFlowStep[];
}

/** A landlord or a tenant as typed, not masked (only the one who may create the lease gets it). */
export interface LeaseDraftParty {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  fiscalCode?: string | null;
  citizenship?: string | null;
  residence?: string | null;
  contactEmail?: string | null;
}

/** What was typed in the data steps, exactly as typed (a wrong value is kept and reported in `flow`). */
export interface LeaseDraftValues {
  propertyId?: string | null;
  landlords: LeaseDraftParty[];
  tenants: LeaseDraftParty[];
  contractType?: string | null;
  taxRegime?: string | null;
  monthlyRent?: number | null;
  securityDeposit?: number | null;
  /** The transitory type made in CasaZen only (step ③): who has the need that justifies the short term, `Landlord` or `Tenant`. */
  transitoryParty?: string | null;
  /** The transitory type made in CasaZen only (step ③): the need itself, in a few words. */
  transitoryNeed?: string | null;
  startDate?: string | null;
  /** Imported contracts and the transitory type: the last day of the term, as the contract states it. */
  endDate?: string | null;
  /** The transitory type made in CasaZen only (step ④): the documents attached to prove the need, asked when the term is long enough. */
  transitoryDocumentation?: string | null;
}

/** `GET /leases/:id/draft`. */
export interface LeaseDraft {
  id: string;
  /** The number a save is checked against: another tab or device that saved first makes it stale (409). */
  version: number;
  origin: LeaseOrigin;
  wizardMaxStep: number;
  reviewConfirmedAt: string | null;
  sentForSignatureAt: string | null;
  updatedAt: string;
  values: LeaseDraftValues;
  flow: LeaseDraftFlow;
}

/** `POST /leases/drafts`: a draft with only the property. Its id is the leaseId a partner links its practice to. */
export interface LeaseDraftCreated {
  id: string;
  version: number;
  flow: LeaseDraftFlow;
}

/** `PATCH /leases/:id/draft`: the new version, the flow again, and the ids the server gave the parties, in the order sent. */
export interface LeaseDraftSaved {
  version: number;
  flow: LeaseDraftFlow;
  landlordIds: string[];
  tenantIds: string[];
}

/** What a check of the review is worth, worst first. */
export type LeaseReviewSeverity = 'Block' | 'Warn' | 'Info' | 'Ok';

export interface LeaseReviewCheck {
  code: string;
  severity: LeaseReviewSeverity;
  /** The step where it is fixed. */
  step: number;
  params?: Record<string, unknown> | null;
}

/** `GET /leases/:id/review`. */
export interface LeaseReview {
  version: number;
  reviewConfirmedAt: string | null;
  checks: LeaseReviewCheck[];
  counts: { block: number; warn: number; info: number; ok: number };
}

/** `POST|DELETE /leases/:id/review/confirm`. */
export interface LeaseReviewConfirmation {
  version: number;
  reviewConfirmedAt: string | null;
  flow: LeaseDraftFlow;
}

/** `POST|DELETE /leases/:id/sent`: the contract downloaded for the signature on paper, or that download taken back. */
export interface LeaseSent {
  version: number;
  sentForSignatureAt: string | null;
  flow: LeaseDraftFlow;
}

/** `GET /long-rent/rules`: the figures the server applies. No figure of law is written in the interface. */
export interface LongRentRules {
  termMonths: Record<string, number>;
  renewalMonths: Record<string, number>;
  noticeMonths: number;
  registrationDays: number;
  depositMaxRents: number;
  /** Types that can be made in CasaZen (the transitory one too, with the official model, since TR). */
  availableTypes: string[];
  /** Types a contract already signed elsewhere can have. */
  importedTypes: string[];
  /** The free term of the transitory type. */
  transitoryTermMonths: { min: number; max: number };
  /** A transitory contract that lasts more days than this proves its need with documents attached to the contract. */
  transitoryDocumentationAfterDays: number;
  /** In a municipality with more inhabitants than this the rent of a transitory contract has to be inside the bands of the territorial agreement. */
  transitoryBandFromInhabitants: number;
}

/** Where the reading of the contract the owner uploaded is (`GET /leases/:id/draft/reading`): none uploaded, being read, read, or not readable. */
export type LeaseReadingState = 'None' | 'Reading' | 'Done' | 'Failed';

/** What became of a value the contract states: written (`Read`), already there and the same (`Agrees`), another is typed (`Conflict`), refused by the rules (`Unusable`). */
export type LeaseReadingFieldState = 'Read' | 'Agrees' | 'Conflict' | 'Unusable';

/** One value of the contract: the name of the field and, for a person, the entry of the draft (`partyId`). Never the value itself. */
export interface LeaseReadingField {
  /** `contractType`, `taxRegime`, `monthlyRent`, `securityDeposit`, `startDate`, `endDate`, `property`, or for a person `firstName`, `lastName`, `fiscalCode`, `residence`, `citizenship`, `party`. */
  field: string;
  partyId: string | null;
  role: string | null;
  state: LeaseReadingFieldState;
  confidence: number;
  /** Worked out from the contract (the monthly rent from the annual one, a deposit from «N mensilità»), not written in it as such. */
  derived: boolean;
}

/** A contract document of the draft and where its reading is; `error` is a code (`unreadable`, `ocr_unavailable`, `no_text`, `nothing_found`, `file_missing`, `error`) when it failed. */
export interface LeaseReadingDocument {
  id: string;
  fileName: string;
  status: 'NotStarted' | 'Processing' | 'Completed' | 'NeedsReview' | 'Failed' | 'Skipped';
  error: string | null;
}

/** `GET /leases/:id/draft/reading`. */
export interface LeaseReading {
  state: LeaseReadingState;
  documents: LeaseReadingDocument[];
  fields: LeaseReadingField[];
  /** `YYYY-MM-DD`: the day of the signature, when the contract states it. */
  stipulaDate: string | null;
  /** The contract document the final import can use instead of a file sent again. */
  contractDocumentId: string | null;
}

/** `POST /leases/:id/import`: the day of the signature and the signed PDF, either the file or the contract document already uploaded to the draft. */
export type ImportSignedInput = { stipulaDate: string } & ({ signedContract: File } | { contractDocumentId: string });

/** `GET /long-rent/landlord-defaults`: the landlord the wizard starts from; every field may be null. */
export interface LandlordDefaults {
  firstName: string | null;
  lastName: string | null;
  fiscalCode: string | null;
  residence: string | null;
  contactEmail: string | null;
}
