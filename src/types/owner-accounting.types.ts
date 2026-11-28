/**
 * The owner accounting of an agency (E06/F05/US02, NF-109, NF-110, ADR-012, ADR-017, ADR-018, ADR-019): the contract of the endpoints
 * `api/owner-accounting/*` (ledger, statement versions, month-end close, payouts, external invoice links), `api/owners/{id}/fiscal-profiles`,
 * `api/withholding/{f24,annual,reconciliation}` (filing states) and `GET api/onboarding/owners/readiness`.
 *
 * The API writes the enums by name (`Draft`, `BookingRevenue`) and the days as `yyyy-MM-dd`; the instants are UTC ISO strings. It leaves out
 * nothing: a member without a value is `null`. A profile answers its identifiers, address and bank account masked unless the caller holds
 * `agency.owner.financial.manage` (`masked`). No type here carries a guest name or any other personal data of a guest: the ledger of an
 * owner holds ids, amounts and codes only.
 */

import type { OwnerPortalTouristTax } from './owner-portal-statements.types';

export type OwnerLedgerEntryType =
  | 'BookingRevenue'
  | 'ChannelFee'
  | 'AgencyCommission'
  | 'OwnerCharge'
  | 'OwnerExpense'
  | 'OwnerPayment'
  | 'AgencyPayment'
  | 'Correction'
  | 'Withholding'
  /** The VAT an owner invoice added on top of the commission and the recharges (E14): the statement counts it with the commission. */
  | 'AgencyVat'
  | 'ChannelFeeBorneByAgency';

type OwnerLedgerSourceType = 'Payment' | 'Booking' | 'OwnerCharge' | 'WireBatch' | 'Manual' | 'OwnerPayout' | 'MandateFlatFee' | 'OwnerInvoice';

export type OwnerStatementVersionStatus = 'Draft' | 'Flagged' | 'Approved' | 'Published' | 'Superseded';

export type OwnerClosePeriodStatus = 'Open' | 'Closed';

type OwnerPayoutStatus = 'Confirmed' | 'Reversed';

type TaxDecision = 'Applicable' | 'NotApplicable';

/** Where a tax file (an F24, the annual data) is: generated and reviewed are never filed. */
export type TaxFilingState = 'Generated' | 'Reviewed' | 'Submitted' | 'Accepted' | 'Rejected';

export type OwnerExternalDocumentStatus = 'Entered' | 'Verified';

export interface OwnerReadinessIssue {
  code: string;
  ownerId: string | null;
  propertyId: string | null;
  sourceId: string | null;
  blocking: boolean;
}

export interface OwnerPeriodReadiness {
  ownerId: string;
  status: OwnerClosePeriodStatus;
  isDirty: boolean;
  latestVersion: number | null;
  latestStatus: OwnerStatementVersionStatus | null;
  issues: OwnerReadinessIssue[];
  ready: boolean;
}

export interface OwnerCloseReadiness {
  year: number;
  month: number;
  issues: OwnerReadinessIssue[];
  owners: OwnerPeriodReadiness[];
}

export interface OwnerPostingResult {
  year: number;
  month: number;
  posted: number;
  reversed: number;
  unchanged: number;
  issues: OwnerReadinessIssue[];
}

export interface OwnerLedgerEntry {
  id: string;
  ownerId: string;
  propertyId: string | null;
  type: OwnerLedgerEntryType;
  source: OwnerLedgerSourceType;
  sourceId: string | null;
  sourceReference: string | null;
  sourceDocumentId: string | null;
  attachmentReference: string | null;
  serviceDate: string;
  recognitionDate: string;
  paymentDate: string | null;
  year: number;
  month: number;
  ownershipId: string | null;
  sharePercent: number;
  originalCurrency: string;
  sourceAmount: number;
  originalAmount: number;
  statementCurrency: string;
  fxRate: number;
  fxSource: string | null;
  fxDate: string | null;
  taxCode: string | null;
  ruleVersion: string | null;
  amount: number;
  reversesEntryId: string | null;
  description: string | null;
  postedAt: string;
  informational?: boolean;
}

export interface OwnerStatementVersion {
  id: string;
  ownerId: string;
  year: number;
  month: number;
  version: number;
  status: OwnerStatementVersionStatus;
  currency: string;
  cutoffAt: string;
  openingBalance: number;
  revenue: number;
  channelFees: number;
  commission: number;
  charges: number;
  payments: number;
  corrections: number;
  closingBalance: number;
  entryCount: number;
  entriesSha256: string;
  issuesJson: string | null;
  approvedAt: string | null;
  approvedByUserId: string | null;
  publishedAt: string | null;
  publishedByUserId: string | null;
  publishedSha256: string | null;
  supersedesVersionId: string | null;
  supersededByVersionId: string | null;
  createdAt: string;
}

export interface OwnerStatementVersionDetail {
  version: OwnerStatementVersion;
  entries: OwnerLedgerEntry[];
  touristTax?: OwnerPortalTouristTax[];
}

export interface OwnerClosePeriod {
  ownerId: string;
  year: number;
  month: number;
  status: OwnerClosePeriodStatus;
  isDirty: boolean;
  closedAt: string | null;
  closedByUserId: string | null;
  closedVersionId: string | null;
  dueAmount: number | null;
  paidAmount: number | null;
  difference: number | null;
  waiverReason: string | null;
  waivedByUserId: string | null;
  waivedAt: string | null;
  retentionJurisdiction: string | null;
  retentionYears: number | null;
  retainUntil: string | null;
  legalHold: boolean;
  legalHoldReason: string | null;
  legalHoldAt: string | null;
}

export interface OwnerAccountingEvidence {
  ownerId: string;
  year: number;
  month: number;
  period: OwnerClosePeriod | null;
  versions: OwnerStatementVersion[];
  publishedFiles: { versionId: string; version: number; sha256: string; content: string }[];
  entries: OwnerLedgerEntry[];
  charges: unknown[];
}

export interface OwnerFxRate {
  id: string;
  baseCurrency: string;
  quoteCurrency: string;
  rateDate: string;
  rate: number;
  source: string;
  createdAt: string;
}

export interface OwnerExternalDocument {
  id: string;
  statementVersionId: string;
  ownerId: string;
  provider: string;
  externalId: string;
  externalNumber: string;
  externalDate: string;
  documentUrl: string | null;
  documentSha256: string | null;
  status: OwnerExternalDocumentStatus;
  verifiedAt: string | null;
  verifiedByUserId: string | null;
  removedAt: string | null;
  removedByUserId: string | null;
  removalReason: string | null;
  createdAt: string;
  createdByUserId: string | null;
}

/**
 * A withholding decision of a payout, with the rule it was taken on. The base and the amount are in euro, the currency of the F24 (`facts.withholdingCurrency` says it), whatever the currency of the payout.
 * `facts` are the facts of the owner ledger the decision was taken on; they are absent in the decision of a payout made before they were read from the ledger (E18/F01/US01), whose facts were typed.
 */
export interface TaxObligationEvidence {
  id: string;
  decision: TaxDecision;
  reasonCode: string;
  jurisdiction: string;
  ruleCode: string;
  ruleVersion: string;
  grossBase: number | null;
  ratePercent: number | null;
  rounding: string | null;
  amount: number | null;
  taxCode: string | null;
  paidOn: string;
  periodYear: number;
  periodMonth: number;
  reversesEvidenceId: string | null;
  createdAt: string;
  facts?: PayoutFacts | null;
}

export interface PayoutStayFact {
  bookingId: string;
  propertyId: string | null;
  channel: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  sharePercent: number;
  grossCurrency: string;
  gross: number;
  touristTax: number;
  revenuePath: string;
  qualifying: boolean;
  qualifyingReason: string;
  companyTenantDecisionPending: boolean;
  collectedByAgency: boolean;
  collection: string;
  withheldByPortal: boolean;
  portalWithholding: string | null;
  inBase: boolean;
  baseAmount: number | null;
  reason: string;
}

interface PayoutFx {
  from: string;
  to: string;
  rate: number;
  source: string | null;
  day: string | null;
}

export interface PayoutFacts {
  source: string;
  currency: string;
  grossAmount: number;
  balance: number;
  withholdingCurrency: string;
  agencyCollected: boolean | null;
  qualifyingShortLet: boolean | null;
  components: Record<string, number>;
  stayIds: string[];
  decidedEntryIds: string[] | null;
  stays: PayoutStayFact[];
  portalsWithholding: string[];
  fx: PayoutFx | null;
  parameters: OwnerAccountingRuleParameters | null;
}

export interface OwnerPayoutPreview {
  facts: PayoutFacts;
  balance: number;
  currency: string;
  decision: TaxDecision | null;
  reasonCode: string | null;
  grossBase: number | null;
  ratePercent: number | null;
  rounding: string | null;
  withholdingInEuro: number | null;
  taxCode: string | null;
  withholdingAmount: number | null;
  netAmount: number | null;
  blockingCode: string | null;
  blockingField: string | null;
}

export interface OwnerPayout {
  id: string;
  ownerId: string;
  statementVersionId: string;
  idempotencyKey: string;
  reference: string | null;
  paidOn: string;
  currency: string;
  grossAmount: number;
  withholdingAmount: number;
  netAmount: number;
  agencyCollected: boolean | null;
  qualifyingShortLet: boolean | null;
  status: OwnerPayoutStatus;
  confirmedAt: string;
  reversedAt: string | null;
  reversalReason: string | null;
  evidence: TaxObligationEvidence[];
}

export interface OwnerPayoutCommand {
  idempotencyKey: string;
  ownerId: string;
  statementVersionId: string;
  currency: string;
  paidOn: string;
  reference?: string;
}

/** An F24 with its filing state: generated and reviewed are never filed; submitted carries the handoff, accepted the receipt. */
export interface TaxF24Record {
  id: string;
  referenceMonth: number;
  referenceYear: number;
  totalAmount: number;
  taxCode: string;
  dueDate: string;
  paidAt: string | null;
  isOverdue: boolean;
  createdAt: string;
  filingState: TaxFilingState;
  ruleVersion: string | null;
  handoffReference: string | null;
  receiptReference: string | null;
  rejectionReason: string | null;
}

export interface TaxReportingDataset {
  id: string;
  kind: string;
  year: number;
  totalGrossBase: number;
  totalWithheld: number;
  evidenceCount: number;
  evidenceSha256: string;
  payloadJson: string;
  filingState: TaxFilingState;
  handoffReference: string | null;
  receiptReference: string | null;
  rejectionReason: string | null;
  generatedAt: string;
}

export interface TaxFilingCommand {
  state: Exclude<TaxFilingState, 'Generated'>;
  handoffReference?: string;
  receiptReference?: string;
  reason?: string;
}

/** The obligations of a month against its F24 (`f24` is `null` while there is none). */
interface TaxPeriodReconciliation {
  month: number;
  obligations: number;
  f24: number | null;
  filingState: TaxFilingState | null;
}

/** `GET api/withholding/reconciliation/{year}`: the obligations of each month against the F24 and of the year against the annual data. */
export interface TaxReconciliation {
  year: number;
  obligationsTotal: number;
  f24Total: number;
  annualTotal: number | null;
  months: TaxPeriodReconciliation[];
  reconciled: boolean;
}

export type OwnerEntityKind = 'NaturalPerson' | 'LegalEntity';

/**
 * A fiscal profile of an owner, valid from a day (the one in force ends the day before the next). The identifiers, the address and the
 * bank account are masked (`masked`) unless the caller holds `agency.owner.financial.manage`.
 */
export interface OwnerFiscalProfile {
  id: string;
  propertyOwnerId: string;
  validFrom: string;
  validTo: string | null;
  entityKind: OwnerEntityKind;
  legalName: string | null;
  taxResidenceCountry: string | null;
  legalAddress: string | null;
  fiscalCode: string | null;
  vatNumber: string | null;
  foreignTaxId: string | null;
  settlementCurrency: string | null;
  bankAccountReference: string | null;
  mandateRole: string | null;
  mandateFrom: string | null;
  mandateTo: string | null;
  revenueRecognitionRule: string | null;
  expenseCommissionModel: string | null;
  workingCapitalRule: string | null;
  taxJurisdiction: string | null;
  accountingPolicyId: string | null;
  masked: boolean;
}

export interface OwnerFiscalProfileCommand {
  validFrom: string;
  entityKind: OwnerEntityKind;
  legalName?: string;
  taxResidenceCountry?: string;
  legalAddress?: string;
  fiscalCode?: string;
  vatNumber?: string;
  foreignTaxId?: string;
  settlementCurrency?: string;
  bankAccountReference?: string;
  mandateRole?: string;
  mandateFrom?: string;
  mandateTo?: string;
  revenueRecognitionRule?: string;
  expenseCommissionModel?: string;
  workingCapitalRule?: string;
  taxJurisdiction?: string;
  accountingPolicyId?: string;
}

export interface OwnerAccountingRuleParameters {
  withholdingApplies: boolean;
  withholdingRatePercent?: number | null;
  withholdingTaxCode?: string | null;
  requiresAgencyCollection: boolean;
  requiresQualifyingShortLet: boolean;
  grossBaseComponents: string[];
  rounding?: string | null;
  retentionYears?: number | null;
}

export interface OwnerAccountingPolicy {
  id: string;
  jurisdiction: string;
  ruleCode: string;
  version: string;
  validFrom: string;
  validTo: string | null;
  sourceUrl: string;
  sourceSha256: string;
  parameters: OwnerAccountingRuleParameters | null;
  approved: boolean;
  approvedAt: string | null;
  approvedByName: string | null;
}

export interface OwnerAccountingPolicyCommand {
  jurisdiction: string;
  ruleCode: string;
  version: string;
  validFrom: string;
  validTo?: string;
  sourceUrl: string;
  sourceSha256: string;
  parameters: OwnerAccountingRuleParameters;
}

export interface OwnerMandateInForce {
  id: string;
  validFrom: string;
  validTo: string | null;
  commissionPercent: number;
  commissionBase: CommissionBase;
  commissionIncludesVat: boolean;
}

export interface PropertyOwnerSummary {
  id: string;
  firstName: string;
  lastName: string;
  ibanMasked?: string | null;
  propertyCount?: number;
  entityKind?: OwnerEntityKind | null;
  settlementCurrency?: string | null;
  mandateInForce?: OwnerMandateInForce | null;
}

export interface OwnerOnboardingReason {
  dimension: string;
  code: string;
  field: string | null;
  propertyId: string | null;
}

/**
 * A warning of an owner (E18/F01/US03/T01): it says what the agency should know and never stops the accounting. `short_let_business_presumed`: the apartments the agency manages for the owner and the ones it
 * declared outside the agency are more than the limit of a private person (`maxUnits`), so the owner is presumed to run a business, and `suggestion` (`issuer_profile`) says what to do about it.
 */
export interface OwnerOnboardingWarning {
  code: string;
  managedUnits: number;
  externalUnits: number;
  maxUnits: number;
  suggestion: string | null;
}

/** An owner of `GET api/onboarding/owners/readiness`. `warnings` are empty unless the exports and checks of the Italian withholding are on (`taxReportingExports`). */
interface OwnerOnboardingOwner {
  ownerId: string;
  displayName: string;
  accountingReady: boolean;
  reasons: OwnerOnboardingReason[];
  warnings?: OwnerOnboardingWarning[];
}

export interface OwnershipIssue {
  kind: 'gap' | 'shortfall' | 'excess' | 'ownerOverlap';
  from: string;
  to: string | null;
  totalPercent: number;
  ownerId: string | null;
}

export interface OwnerOnboardingProperty {
  propertyId: string;
  name: string;
  ownershipReady: boolean;
  reasons: OwnerOnboardingReason[];
  issues: OwnershipIssue[];
}

export interface OwnerOnboardingReadiness {
  asOf: string;
  summary: { financialReady: boolean };
  owners: OwnerOnboardingOwner[];
  properties: OwnerOnboardingProperty[];
}

export type CommissionBase = 'GrossExclTouristTax' | 'GrossExclTouristTaxAndCleaning';

type CommissionTreatment = 'Deductible' | 'NotDeductible';

/**
 * A version of the mandate of an owner (`GET api/owners/{id}/mandates`, the newest first): in force from `validFrom` to `validTo` (both included, `yyyy-MM-dd`; `null` until a later
 * version). The commission and the flat fees are «+ IVA» unless `commissionIncludesVat` says they already hold it (⚖ R4); the flat fees are per stay, in the settlement currency of the
 * owner (`null`: none). `hasDocument` only says the signed mandate is on file: the reference itself is never returned.
 */
export interface OwnerMandate {
  id: string;
  ownerId: string;
  ownershipId: string | null;
  validFrom: string;
  validTo: string | null;
  commissionPercent: number;
  commissionBase: CommissionBase;
  commissionIncludesVat: boolean;
  cleaningFlatRate: number | null;
  linenFlatRate: number | null;
  passthroughPaymentFees: boolean;
  withholdingTreatment: CommissionTreatment;
  monthlyFrequency: number;
  hasDocument: boolean;
  documentUploaded?: boolean;
  createdAt: string;
  createdByUserId: string | null;
}

export interface OwnerMandateCommand {
  validFrom: string;
  commissionPercent: number;
  commissionBase: CommissionBase;
  commissionIncludesVat: boolean;
  cleaningFlatRate: number | null;
  linenFlatRate: number | null;
  passthroughPaymentFees: boolean;
  withholdingTreatment: CommissionTreatment;
  documentReference?: string;
}

export interface OwnerAddress {
  ownerId: string;
  street: string | null;
  buildingNumber: string | null;
  postalCode: string | null;
  town: string | null;
  province: string | null;
  country: string | null;
}

export interface OwnerAddressCommand {
  street: string;
  buildingNumber?: string;
  postalCode: string;
  town: string;
  province?: string;
  country: string;
}

export const OWNER_BULK_ACTIONS = ['Post', 'Generate', 'Approve', 'Publish', 'Close'] as const;
export type OwnerBulkAction = (typeof OWNER_BULK_ACTIONS)[number];

type OwnerBulkRunStatus = 'Queued' | 'Running' | 'Completed' | 'Failed';

/**
 * What a bulk step did for one owner. `ok` is the truth: the owner is where the step leads, done now or already so (`unchanged`). `code` is the stable code of the reason: why the step was not
 * done (`ok` false), or a note on a row that is `ok` (`owner_period_closed`; `owner_statement_flagged` for a version that was made with anomalies). `issues` are the blocking issue codes behind
 * it and `details` the facts a person needs to act on it (`due`, `paid` and `difference` of a close that does not reconcile: amounts with no currency). Never a name, an address or a ledger line.
 */
export interface OwnerBulkOwnerResult {
  ownerId: string;
  ok: boolean;
  code: string | null;
  unchanged: boolean;
  issues: string[] | null;
  details: Record<string, unknown> | null;
}

/**
 * A bulk run (`POST api/owner-accounting/periods/{year}/{month}/bulk`, and `GET …/bulk/{jobId}` while a queued one goes on): asked for `total` owners, answered for the `results` it has so far.
 * Up to a few owners the answer is the finished run (`jobId` null); for more it is queued (`Queued`, no rows yet) and its `jobId` is read until it ends. The run also carries counts and an
 * `allDone` of its own, which the page never reads: it counts the rows itself, so that «tutti fatti» is never said while a row says otherwise.
 */
export interface OwnerBulkRun {
  jobId: string | null;
  action: OwnerBulkAction;
  year: number;
  month: number;
  status: OwnerBulkRunStatus;
  total: number;
  results: OwnerBulkOwnerResult[];
  errorCode: string | null;
}

export interface OwnerBulkCommand {
  action: OwnerBulkAction;
  ownerIds?: string[];
}

export interface OwnerMandateReading {
  validFrom: string | null;
  commissionPercent: number | null;
  commissionBase: CommissionBase | null;
  commissionIncludesVat: boolean | null;
  cleaningFlatRate: number | null;
  linenFlatRate: number | null;
  passthroughPaymentFees: boolean | null;
  currency: string | null;
}
