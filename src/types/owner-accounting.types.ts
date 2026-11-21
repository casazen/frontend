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
  | 'Withholding'
  /** The VAT an owner invoice added on top of the commission and the recharges (E14): the statement counts it with the commission. */
  | 'AgencyVat'
  /**
   * The commission of a portal that the agency bears itself (the agency holds the portal account and does not recharge it, FIX/BE-V2-NO-RECHARGE): a line for information only. It keeps its
   * amount and its group, the channel fees, and is in no total and no balance of the owner (`informational`).
   */
  | 'ChannelFeeBorneByAgency';

/** Where a line of the owner ledger comes from. `MandateFlatFee` is a flat fee of the mandate for a stay, `OwnerInvoice` an owner invoice (or its credit note) of CasaZen. */
export type OwnerLedgerSourceType = 'Payment' | 'Booking' | 'OwnerCharge' | 'WireBatch' | 'Manual' | 'OwnerPayout' | 'MandateFlatFee' | 'OwnerInvoice';

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
  /**
   * True for a line for information only (today `ChannelFeeBorneByAgency`, the commission of a portal the agency bears): it is shown and left out of every total and of the balance of the owner,
   * whatever its type. Absent on a server that does not know the rule yet: the line is then one like the others.
   */
  informational?: boolean;
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

/**
 * A version with its lines (the drill-down to the sources) and its tourist tax box. `touristTax` is the box of the statement with its amounts: one row for each stay whose tax the agency
 * collects, for information only and outside every total, the very rows the owner portal reads for the same version (one source builds both). Absent only on a server older than that box,
 * where the page keeps the text of the box and says nothing of its amounts.
 */
export interface OwnerStatementVersionDetail {
  version: OwnerStatementVersion;
  entries: OwnerLedgerEntry[];
  touristTax?: OwnerPortalTouristTax[];
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

/**
 * One stay of a payout with the facts its withholding is decided on (backend `PayoutStayFact`, E18/F01/US01/T01): the owner's gross of it without the tourist tax, the tourist tax that was left out, how the ledger
 * posted it, whether it is a qualifying short let and why, whether the agency collected or handled the money and how, whether its portal already withheld, and whether it is in the base and why. The codes are
 * those of the backend (`PayoutStayReasons`, `ShortLetTreatmentReasons`, `OwnerWithholdingRules`); a code this version does not know is shown as it came. `propertyId` is `null` for a stay with no property.
 */
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

/** The agency's rate of the payout day, from the currency of the withholding to the one of the payout: one unit of `from` is `rate` units of `to`. */
export interface PayoutFx {
  from: string;
  to: string;
  rate: number;
  source: string | null;
  day: string | null;
}

/**
 * The facts of a payout, read from the owner ledger of the version it pays and never typed (backend `PayoutFacts`): the stays with their facts, the balance, the currency of the payout and the one of the withholding (euro),
 * the rate of the day for an owner paid in another currency. Shown read only.
 */
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

/**
 * What a payout of a version on a day would be (`GET api/owner-accounting/payouts/preview?statementVersionId=&paidOn=`), read only: the facts of the ledger, the balance still unpaid (what a payout pays, in `currency`), the
 * decision of the approved rule in force that day (its base, rate, rounding and tax code, the withholding in euro and the one kept from the payout in `currency`, the net), or `blockingCode` (and `blockingField`), the code
 * the confirmation would answer, and then no decision. Nothing of it is typed by a person.
 */
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

/**
 * The payout to confirm (`POST api/owner-accounting/payouts`): who is paid, on which version of the statement, on which day. It carries no amount and no fact of the withholding (E18/F01/US01/T01): what is paid is the
 * balance the version still owes, and the stays, their collection and their qualifying short let are read by the server from the owner ledger. A body that sent them would have them ignored.
 */
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

/**
 * The mandate of an owner in force today as the list of the owners carries it (`mandateInForce` of `GET api/owners`): what a row draws and nothing more. It is the mandate of the owner as
 * a whole (a version with no ownership of its own) that covers today, the latest start when more do: a mandate of a single property and one that starts later are not in it, so a `null`
 * does not say «no mandate» (the versions of the mandate, `mandateStateOn`, answer that).
 */
export interface OwnerMandateInForce {
  id: string;
  validFrom: string;
  validTo: string | null;
  commissionPercent: number;
  commissionBase: CommissionBase;
  commissionIncludesVat: boolean;
}

/**
 * The owner of a property in the registry of the agency (`GET api/owners`): only what the pages show. Besides the person it carries what a row of «Proprietari» needs to be drawn without any other
 * read (`propertyCount`, `entityKind`, `settlementCurrency`, `mandateInForce`): the server writes them all, `null` being its own «none». A member that is absent (a server older than that list) is not
 * «none»: it was not told, and the row says nothing of it (for the mandate, the versions of the owner's mandate are read).
 */
export interface PropertyOwnerSummary {
  id: string;
  firstName: string;
  lastName: string;
  /** The IBAN as the registry answers it, already masked to its last four characters (`****3456`); `null` when the owner has none. Never the full account. */
  ibanMasked?: string | null;
  /** The properties the owner holds today or will hold (an ownership not ended, on a property that still exists), each counted once. */
  propertyCount?: number;
  /** The kind of the fiscal profile in force today (the newest when none is in force, as the page of the owner reads it); `null` for an owner with no profile. */
  entityKind?: OwnerEntityKind | null;
  /** The settlement currency of that profile; `null` when it has none or the owner has no profile. */
  settlementCurrency?: string | null;
  /** The mandate of the owner in force today; `null` when the list has none to say (see {@link OwnerMandateInForce}: it does not mean «no mandate»). */
  mandateInForce?: OwnerMandateInForce | null;
}

/** One missing or wrong fact of an owner or of a property: a code and the name of the field, never a value. */
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
export interface OwnerOnboardingOwner {
  ownerId: string;
  displayName: string;
  accountingReady: boolean;
  reasons: OwnerOnboardingReason[];
  warnings?: OwnerOnboardingWarning[];
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

// ── The mandate and the billing address of an owner (E13/F01/US01/T01, NF-110, NF-115) ───────────────────────────────────

/** What the commission of the agency is a percentage of (backend `CommissionBase`): the tourist tax is never part of it. */
export type CommissionBase = 'GrossExclTouristTax' | 'GrossExclTouristTaxAndCleaning';

/** The tax treatment of the commission for the owner's tax calculation (backend `CommissionTreatment`). */
export type CommissionTreatment = 'Deductible' | 'NotDeductible';

/**
 * A version of the mandate of an owner (`GET api/owners/{id}/mandates`, the newest first): in force from `validFrom` to `validTo` (both included, `yyyy-MM-dd`; `null` until a later
 * version). The commission and the flat fees are «+ IVA» unless `commissionIncludesVat` says they already hold it (⚖ R4); the flat fees are per stay, in the settlement currency of the
 * owner (`null`: none). `hasDocument` only says the signed mandate is on file: the reference itself is never returned.
 */
export interface OwnerMandate {
  id: string;
  ownerId: string;
  /** Set only on a mandate of one ownership, of before E13: the versions the API writes cover every property of the owner. */
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

/** A new version of the mandate (`POST api/owners/{id}/mandates`): the one in force ends the day before `validFrom`, which must be later than the start of every version. */
export interface OwnerMandateCommand {
  validFrom: string;
  commissionPercent: number;
  commissionBase: CommissionBase;
  commissionIncludesVat: boolean;
  cleaningFlatRate: number | null;
  linenFlatRate: number | null;
  passthroughPaymentFees: boolean;
  withholdingTreatment: CommissionTreatment;
  /** Where the signed mandate is, an https address: without it the activation says the document is missing. */
  documentReference?: string;
}

/** The structured billing address of an owner (`GET api/owners/{id}/address`), in clear: personal data, read only by who manages the owners' finances. */
export interface OwnerAddress {
  ownerId: string;
  street: string | null;
  buildingNumber: string | null;
  postalCode: string | null;
  town: string | null;
  province: string | null;
  country: string | null;
}

/** The whole address (`PUT api/owners/{id}/address` replaces it): street, postal code, town and a two-letter country are required, the province too in Italy. */
export interface OwnerAddressCommand {
  street: string;
  buildingNumber?: string;
  postalCode: string;
  town: string;
  province?: string;
  country: string;
}

// ── The month-end for every owner at once (E13/F01/US03/T01, E13/F02/US03/T01, NF-110) ─────────────────────────────────────

/** The steps of the month-end that run for many owners in one call (backend `OwnerBulkAction`, written and read by name), in the order of the month-end. */
export const OWNER_BULK_ACTIONS = ['Post', 'Generate', 'Approve', 'Publish', 'Close'] as const;
export type OwnerBulkAction = (typeof OWNER_BULK_ACTIONS)[number];

/**
 * How far a bulk run is (backend `OwnerBulkRunStatus`, by name). `Completed` says that every owner was answered, never that every owner is done: a row can still be a failure.
 * `Failed` is the run itself failing (not one of its owners): what it did before is in its rows.
 */
export type OwnerBulkRunStatus = 'Queued' | 'Running' | 'Completed' | 'Failed';

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

/** What starts a bulk run: the step, and the owners it is for (left out = every owner of the month; an empty list is refused, never «everyone»). */
export interface OwnerBulkCommand {
  action: OwnerBulkAction;
  ownerIds?: string[];
}

/** Proposals from the signed PDF, never facts until the person reviews and saves. */
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
