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

/** What a line of the owner ledger records. A positive amount is owed to the owner, a negative one reduces it. */
export type OwnerLedgerEntryType =
  | 'BookingRevenue'
  | 'ChannelFee'
  | 'AgencyCommission'
  | 'OwnerCharge'
  | 'OwnerExpense'
  | 'OwnerPayment'
  | 'AgencyPayment'
  | 'Correction'
  | 'Withholding';

/** Where a line of the owner ledger comes from. */
export type OwnerLedgerSourceType = 'Payment' | 'Booking' | 'OwnerCharge' | 'WireBatch' | 'Manual' | 'OwnerPayout';

/** The life of a version of an owner statement. */
export type OwnerStatementVersionStatus = 'Draft' | 'Flagged' | 'Approved' | 'Published' | 'Superseded';

/** Whether the month of an owner is still open. */
export type OwnerClosePeriodStatus = 'Open' | 'Closed';

/** The life of a payout to an owner. */
export type OwnerPayoutStatus = 'Confirmed' | 'Reversed';

/** The withholding decision of a payout. */
export type TaxDecision = 'Applicable' | 'NotApplicable';

/** Where a tax file (an F24, the annual data) is: generated and reviewed are never filed. */
export type TaxFilingState = 'Generated' | 'Reviewed' | 'Submitted' | 'Accepted' | 'Rejected';

/** How far a link to an externally issued invoice was checked. */
export type OwnerExternalDocumentStatus = 'Entered' | 'Verified';

/** An issue of the month-end readiness: a stable code, what it is about, and whether it blocks the approval and the close. */
export interface OwnerReadinessIssue {
  code: string;
  ownerId: string | null;
  propertyId: string | null;
  sourceId: string | null;
  blocking: boolean;
}

/** The readiness of one owner's month. */
export interface OwnerPeriodReadiness {
  ownerId: string;
  status: OwnerClosePeriodStatus;
  isDirty: boolean;
  latestVersion: number | null;
  latestStatus: OwnerStatementVersionStatus | null;
  issues: OwnerReadinessIssue[];
  /** No blocking issue (it includes the ones of the steps of the statement itself: a statement not yet approved is not ready). */
  ready: boolean;
}

/** `GET api/owner-accounting/periods/{year}/{month}/readiness`: the issues of the org (sources without owners) and of each owner. */
export interface OwnerCloseReadiness {
  year: number;
  month: number;
  issues: OwnerReadinessIssue[];
  owners: OwnerPeriodReadiness[];
}

/** `POST api/owner-accounting/periods/{year}/{month}/post`: what the posting did. */
export interface OwnerPostingResult {
  year: number;
  month: number;
  posted: number;
  reversed: number;
  unchanged: number;
  issues: OwnerReadinessIssue[];
}

/** A line of the owner ledger with its source and the facts of its amount. */
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
}

/** A version of an owner statement, without its published file. */
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

/** A version with its lines (the drill-down to the sources). */
export interface OwnerStatementVersionDetail {
  version: OwnerStatementVersion;
  entries: OwnerLedgerEntry[];
}

/** The month of an owner: the close with its reconciliation or waiver, the retention and the legal hold. */
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

/** The evidence of an owner's month, exportable as it is (`…/evidence`). */
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

/** An exchange rate of the owner accounting: one `baseCurrency` is `rate` `quoteCurrency` on `rateDate`. */
export interface OwnerFxRate {
  id: string;
  baseCurrency: string;
  quoteCurrency: string;
  rateDate: string;
  rate: number;
  source: string;
  createdAt: string;
}

/** A link of a version to an invoice issued by the agency's external fiscal system, with its audit facts. CasaZen keeps the link, never an amount. */
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

/** A withholding decision of a payout, with the rule it was taken on. */
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
}

/** A payout to an owner with its withholding evidence (the list leaves the evidence empty, `GET …/payouts/{id}` carries it). */
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

/** The payout to confirm, with the facts the withholding is decided on (`POST api/owner-accounting/payouts`). */
export interface OwnerPayoutCommand {
  idempotencyKey: string;
  ownerId: string;
  statementVersionId: string;
  grossAmount: number;
  currency: string;
  paidOn: string;
  reference?: string;
  agencyCollected: boolean | null;
  qualifyingShortLet: boolean | null;
  components?: Record<string, number>;
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

/** The annual tax data (Certificazione Unica) of a year, with its filing state. */
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

/** A move of a tax file along its filing states, with the reference the move needs. */
export interface TaxFilingCommand {
  state: Exclude<TaxFilingState, 'Generated'>;
  /** For `Submitted`: the controlled manual handoff (who sent it and how). */
  handoffReference?: string;
  /** For `Accepted`: the receipt of the authority. */
  receiptReference?: string;
  /** For `Rejected`: why. */
  reason?: string;
}

/** The obligations of a month against its F24 (`f24` is `null` while there is none). */
export interface TaxPeriodReconciliation {
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

/** The kind of subject of an owner's profile. */
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

/**
 * `GET api/owners/{id}/fiscal-profiles/readiness?date=`: the profile and the approved rule set that apply to the owner on a day, by their ids and codes only. It holds no
 * value of the profile (no identifier, no address, no bank account): it is what a payout asks to choose its rule without reading the profile itself. The refusal is a 422
 * with the code of what blocks (`owner_fiscal_profile_missing`, `owner_fiscal_profile_incomplete`, `owner_fiscal_policy_*`).
 */
export interface OwnerFiscalReadiness {
  ready: boolean;
  profileId: string;
  policyId: string;
  ruleCode: string;
  ruleVersion: string;
  jurisdiction: string;
}

/** The new profile of an owner (`POST api/owners/{id}/fiscal-profiles`): effective from `validFrom`. */
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

/**
 * The parameters of a rule set: whether a withholding applies at the payment to the owner and how. Every figure is the approved one: the
 * code of CasaZen has no default rate, no tax code and no jurisdiction.
 */
export interface OwnerAccountingRuleParameters {
  withholdingApplies: boolean;
  /** A member without a value is `null` in the answer of the API (and left out of the one the page sends). */
  withholdingRatePercent?: number | null;
  withholdingTaxCode?: string | null;
  requiresAgencyCollection: boolean;
  requiresQualifyingShortLet: boolean;
  grossBaseComponents: string[];
  rounding?: string | null;
  retentionYears?: number | null;
}

/** A rule set of the agency: its identity, validity, official source, parameters and the approval of the qualified accountant. */
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

/** The new rule set (`POST api/owner-accounting/policies`): not approved until the accountant's approval is recorded. */
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

/** The owner of a property in the registry of the agency (`GET api/owners`): only what the pages show. */
export interface PropertyOwnerSummary {
  id: string;
  firstName: string;
  lastName: string;
  /** The IBAN as the registry answers it, already masked to its last four characters (`****3456`); `null` when the owner has none. Never the full account. */
  ibanMasked?: string | null;
}

/** One missing or wrong fact of an owner or of a property: a code and the name of the field, never a value. */
export interface OwnerOnboardingReason {
  dimension: string;
  code: string;
  field: string | null;
  propertyId: string | null;
}

/** An owner of `GET api/onboarding/owners/readiness`. */
export interface OwnerOnboardingOwner {
  ownerId: string;
  displayName: string;
  accountingReady: boolean;
  reasons: OwnerOnboardingReason[];
}

/** A stretch of days where the shares of a property are wrong. */
export interface OwnershipIssue {
  kind: 'gap' | 'shortfall' | 'excess' | 'ownerOverlap';
  from: string;
  to: string | null;
  totalPercent: number;
  ownerId: string | null;
}

/** A property whose ownership is not ready. */
export interface OwnerOnboardingProperty {
  propertyId: string;
  name: string;
  ownershipReady: boolean;
  reasons: OwnerOnboardingReason[];
  issues: OwnershipIssue[];
}

/** `GET api/onboarding/owners/readiness` (behind the flag of the activation): what is missing for the registry, the ownership, the mandate, the fiscal profile and the payment data. */
export interface OwnerOnboardingReadiness {
  asOf: string;
  summary: { financialReady: boolean };
  owners: OwnerOnboardingOwner[];
  properties: OwnerOnboardingProperty[];
}
