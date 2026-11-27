import { isAxiosError } from 'axios';
import type { TFunction } from 'i18next';
import type {
  OwnerAccountingPolicy,
  OwnerAccountingRuleParameters,
  OwnerClosePeriodStatus,
  OwnerCloseReadiness,
  OwnerFiscalProfile,
  OwnerLedgerEntry,
  OwnerLedgerEntryType,
  OwnerMandate,
  OwnerMandateInForce,
  OwnerPayout,
  OwnerPayoutCommand,
  OwnerPeriodReadiness,
  OwnerReadinessIssue,
  OwnerStatementVersion,
  OwnerStatementVersionStatus,
  TaxFilingState,
  TaxReconciliation,
} from '@/types';
import { getProblemMessage, toCamelCase } from '@/lib/api-errors';
import { addDays, endOfMonth, startOfMonth } from '@/lib/stay-dates';

export const OWNER_CLOSE_PATH = '/app/account/owner-close';

export const statementPath = (versionId: string) => `${OWNER_CLOSE_PATH}/versions/${versionId}`;

export const closePath = (year: number, month: number) => `${OWNER_CLOSE_PATH}?period=${periodParam({ year, month })}`;

export const ownerFinancialPath = (ownerId: string, period?: Period) => `/app/account/owners/${ownerId}/financial${period ? `?period=${periodParam(period)}` : ''}`;

export const startOfPeriod = (period: Period): string => `${periodParam(period)}-01`;

export const OWNER_ONBOARDING_PATH = '/app/short-rent/onboarding/owners';

export const CHANNEL_COMMISSIONS_PATH = '/app/account/channel-commissions';

export interface Period {
  year: number;
  month: number;
}

export function periodParam({ year, month }: Period): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

export function parsePeriod(value: string | null | undefined, fallback: Period): Period {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(value ?? '');
  if (!match) return fallback;
  const year = Number(match[1]);
  return year >= 2000 && year <= 2100 ? { year, month: Number(match[2]) } : fallback;
}

export function defaultPeriod(today: string): Period {
  const lastOfPrevious = addDays(startOfMonth(today), -1);
  return { year: Number(lastOfPrevious.slice(0, 4)), month: Number(lastOfPrevious.slice(5, 7)) };
}

export function shiftPeriod({ year, month }: Period, months: number): Period {
  const index = year * 12 + (month - 1) + months;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

export function isPeriodOver({ year, month }: Period, today: string): boolean {
  return endOfMonth(`${year}-${String(month).padStart(2, '0')}-01`) < today;
}

export const toCents = (amount: number): number => Math.round(amount * 100);

export const localeOf = (language: string): string => (language.startsWith('en') ? 'en-GB' : 'it-IT');

export function asInstant(value: string): string {
  return value.includes('T') && !/(?:Z|[+-]\d{2}(?::?\d{2})?)$/i.test(value) ? `${value}Z` : value;
}

/**
 * The four groups of the page: what the person does next. `toPrepare` has no statement yet; `toVerify` has one to check (a draft, or one the
 * server flagged because of anomalies); `approved` waits to be published; `published` is with the owner.
 */
export type OwnerGroup = 'toPrepare' | 'toVerify' | 'approved' | 'published';

export const OWNER_GROUPS: readonly OwnerGroup[] = ['toPrepare', 'toVerify', 'approved', 'published'];

export function groupOf(status: OwnerStatementVersionStatus | null | undefined): OwnerGroup {
  switch (status) {
    case 'Draft':
    case 'Flagged':
      return 'toVerify';
    case 'Approved':
      return 'approved';
    case 'Published':
      return 'published';
    default:
      return 'toPrepare';
  }
}

const LIFECYCLE_CODES: ReadonlySet<string> = new Set(['statement_missing', 'statement_not_approved', 'period_closed']);

export function anomaliesOf(issues: readonly OwnerReadinessIssue[]): OwnerReadinessIssue[] {
  return issues.filter((issue) => !LIFECYCLE_CODES.has(issue.code));
}

export const blockingAnomalies = (issues: readonly OwnerReadinessIssue[]): OwnerReadinessIssue[] => anomaliesOf(issues).filter((issue) => issue.blocking);

const issueKey = (issue: OwnerReadinessIssue): string => `${issue.code}|${issue.propertyId ?? ''}|${issue.sourceId ?? ''}`;

export interface CloseSummary {
  owners: number;
  ready: number;
  percent: number;
  closed: number;
  blocking: number;
  warnings: number;
  orgBlocking: number;
  groups: Record<OwnerGroup, number>;
}

export function summarize(readiness: OwnerCloseReadiness): CloseSummary {
  const groups: Record<OwnerGroup, number> = { toPrepare: 0, toVerify: 0, approved: 0, published: 0 };
  const toldOfTheMonth = new Set(readiness.issues.map(issueKey));
  let ready = 0;
  let closed = 0;
  let blocking = 0;
  let warnings = 0;
  for (const owner of readiness.owners) {
    groups[groupOf(owner.latestStatus)] += 1;
    if (owner.status === 'Closed') closed += 1;
    const anomalies = anomaliesOf(owner.issues);
    if (!anomalies.some((issue) => issue.blocking)) ready += 1;
    const own = anomalies.filter((issue) => !toldOfTheMonth.has(issueKey(issue)));
    blocking += own.filter((issue) => issue.blocking).length;
    warnings += own.filter((issue) => !issue.blocking).length;
  }
  const orgBlocking = readiness.issues.filter((issue) => issue.blocking).length;
  const owners = readiness.owners.length;
  return { owners, ready, percent: owners === 0 ? 0 : Math.round((ready / owners) * 100), closed, blocking: blocking + orgBlocking, warnings, orgBlocking, groups };
}

export interface AnomalyGroup {
  key: string;
  ownerId: string | null;
  code: string;
  blocking: boolean;
  count: number;
  issue: OwnerReadinessIssue;
}

export function groupAnomalies(readiness: OwnerCloseReadiness): AnomalyGroup[] {
  const groups = new Map<string, AnomalyGroup>();
  const add = (ownerId: string | null, issue: OwnerReadinessIssue) => {
    const key = `${ownerId ?? 'month'}|${issue.code}|${issue.blocking}`;
    const known = groups.get(key);
    if (known) known.count += 1;
    else groups.set(key, { key, ownerId, code: issue.code, blocking: issue.blocking, count: 1, issue });
  };
  const toldOfTheMonth = new Set(readiness.issues.map(issueKey));
  for (const issue of readiness.issues) add(null, issue);
  for (const owner of readiness.owners) {
    for (const issue of anomaliesOf(owner.issues)) if (!toldOfTheMonth.has(issueKey(issue))) add(owner.ownerId, issue);
  }
  return [...groups.values()].sort((a, b) => Number(b.blocking) - Number(a.blocking) || a.code.localeCompare(b.code) || (a.ownerId ?? '').localeCompare(b.ownerId ?? ''));
}

export function ownersOf(readiness: OwnerCloseReadiness, group: OwnerGroup): OwnerPeriodReadiness[] {
  return readiness.owners.filter((owner) => groupOf(owner.latestStatus) === group);
}

export type IssueAction =
  | { kind: 'post' }
  | { kind: 'prepare' }
  | { kind: 'regenerate' }
  | { kind: 'approve' }
  | { kind: 'fx' }
  | { kind: 'correction' }
  | { kind: 'profile' }
  | { kind: 'onboarding' }
  | { kind: 'channelRules' }
  | { kind: 'payment'; paymentId: string }
  | { kind: 'none' };

export const ISSUE_CODES = [
  'channel_commission_missing',
  'duplicate_entry',
  'fx_missing',
  'currency_mixed',
  'ledger_statement_imbalance',
  'late_source_after_close',
  'mandate_missing_for_stay',
  'negative_balance',
  'owner_fiscal_policy_jurisdiction_mismatch',
  'owner_fiscal_policy_missing',
  'owner_fiscal_policy_not_approved',
  'owner_fiscal_policy_not_effective',
  'owner_fiscal_profile_incomplete',
  'owner_fiscal_profile_missing',
  'owner_invoice_after_approval',
  'ownership_missing',
  'ownership_share_gap',
  'period_closed',
  'period_dirty',
  'short_let_business_presumed',
  'source_amount_missing',
  'statement_missing',
  'statement_not_approved',
  'unposted_source',
] as const;

export type IssueCode = (typeof ISSUE_CODES)[number];

export const camelCode = toCamelCase;

export function isKnownIssue(code: string): code is IssueCode {
  return (ISSUE_CODES as readonly string[]).includes(code);
}

export function actionForIssue(issue: OwnerReadinessIssue): IssueAction {
  switch (issue.code) {
    case 'unposted_source':
    case 'duplicate_entry':
      return { kind: 'post' };
    case 'statement_missing':
      return { kind: 'prepare' };
    // `owner_invoice_after_approval`: the invoice of the property manager was issued after the statement was approved, so its VAT is in the ledger and not in the version.
    case 'period_dirty':
    case 'ledger_statement_imbalance':
    case 'owner_invoice_after_approval':
      return { kind: 'regenerate' };
    case 'statement_not_approved':
      return { kind: 'approve' };
    case 'fx_missing':
      return { kind: 'fx' };
    case 'late_source_after_close':
      return { kind: 'correction' };
    // `mandate_missing_for_stay`: no mandate of the owner covers the day of a stay (its revenue is posted, no commission is guessed): the mandate is written in the owner's financial data.
    // `short_let_business_presumed` (E18/F01/US03/T01, never blocking): the owner lets more apartments than a private person may, the agency managed ones and the ones it declared outside it; the
    // owner's financial data hold the number it declared and what to do about the business.
    case 'mandate_missing_for_stay':
    case 'short_let_business_presumed':
    case 'currency_mixed':
    case 'owner_fiscal_profile_missing':
    case 'owner_fiscal_profile_incomplete':
    case 'owner_fiscal_policy_missing':
    case 'owner_fiscal_policy_not_approved':
    case 'owner_fiscal_policy_not_effective':
    case 'owner_fiscal_policy_jurisdiction_mismatch':
      return { kind: 'profile' };
    case 'ownership_missing':
    case 'ownership_share_gap':
      return { kind: 'onboarding' };
    case 'channel_commission_missing':
      return { kind: 'channelRules' };
    case 'source_amount_missing':
      return issue.sourceId ? { kind: 'payment', paymentId: issue.sourceId } : { kind: 'none' };
    default:
      return { kind: 'none' };
  }
}

export interface RowActions {
  prepare: boolean;
  regenerate: boolean;
  approve: boolean;
  publish: boolean;
  payout: boolean;
  close: boolean;
  /** The month cannot be closed yet because it is not over. */
  closeWaitsForTheEnd: boolean;
  stale: boolean;
  settled: boolean;
}

/**
 * What the person can do with an owner's month, from its state: the same rules the server applies (it answers 409 and 422 for the rest, and
 * nothing here lets an action through that the server would refuse because of the state). A published version is never edited: the only way to
 * change what the owner has is a new version, which supersedes it.
 */
export function actionsOf(input: {
  status: OwnerClosePeriodStatus;
  version: Pick<OwnerStatementVersion, 'status'> | null;
  isDirty: boolean;
  issues: readonly OwnerReadinessIssue[];
  monthOver: boolean;
  settled?: boolean;
}): RowActions {
  const none: RowActions = { prepare: false, regenerate: false, approve: false, publish: false, payout: false, close: false, closeWaitsForTheEnd: false, stale: false, settled: false };
  if (input.status === 'Closed') return none;

  const stale = input.isDirty || input.issues.some((issue) => issue.code === 'ledger_statement_imbalance' || issue.code === 'period_dirty');
  const settled = input.settled === true;
  const status = input.version?.status ?? null;
  switch (status) {
    case null:
    case 'Superseded':
      return { ...none, prepare: true };
    case 'Flagged':
      return { ...none, regenerate: true, stale };
    case 'Draft':
      return { ...none, approve: !stale, regenerate: stale, stale };
    case 'Approved':
      return { ...none, publish: !stale, payout: true, regenerate: stale, close: input.monthOver && !stale, closeWaitsForTheEnd: !input.monthOver, stale, settled };
    case 'Published':
      return { ...none, payout: true, regenerate: stale, close: input.monthOver && !stale, closeWaitsForTheEnd: !input.monthOver, stale, settled };
  }
}

export function isSettled(version: Pick<OwnerStatementVersion, 'closingBalance' | 'currency'>, payouts: readonly OwnerPayout[], versionIds: readonly string[]): boolean {
  return toCents(previewReconciliation(version, payouts, versionIds).difference) <= 0;
}

export interface ReconciliationPreview {
  due: number;
  paid: number;
  difference: number;
  needsWaiver: boolean;
  wiresCountInstead: boolean;
  payouts: OwnerPayout[];
}

export function previewReconciliation(version: Pick<OwnerStatementVersion, 'closingBalance' | 'currency'>, payouts: readonly OwnerPayout[], versionIds: readonly string[]): ReconciliationPreview {
  const confirmed = payouts.filter((payout) => payout.status === 'Confirmed' && versionIds.includes(payout.statementVersionId));
  const paidCents = confirmed.filter((payout) => payout.currency === version.currency).reduce((sum, payout) => sum + toCents(payout.grossAmount), 0);
  const dueCents = toCents(version.closingBalance);
  const differenceCents = dueCents - paidCents;
  return {
    due: dueCents / 100,
    paid: paidCents / 100,
    difference: differenceCents / 100,
    needsWaiver: differenceCents !== 0 || dueCents < 0,
    wiresCountInstead: confirmed.length === 0,
    payouts: confirmed,
  };
}

export type RuleBlock = 'profile_missing' | 'profile_incomplete' | 'policy_missing' | 'policy_not_approved' | 'policy_not_effective' | 'policy_jurisdiction_mismatch';

export type RuleResolution =
  | { ok: true; profile: OwnerFiscalProfile; policy: OwnerAccountingPolicy; parameters: OwnerAccountingRuleParameters }
  | { ok: false; reason: RuleBlock };

const RULE_BLOCK_OF_CODE: Readonly<Record<string, RuleBlock>> = {
  owner_fiscal_profile_missing: 'profile_missing',
  owner_fiscal_profile_incomplete: 'profile_incomplete',
  owner_fiscal_policy_missing: 'policy_missing',
  owner_fiscal_policy_not_approved: 'policy_not_approved',
  owner_fiscal_policy_not_effective: 'policy_not_effective',
  owner_fiscal_policy_jurisdiction_mismatch: 'policy_jurisdiction_mismatch',
};

export function ruleBlockOfCode(code: string | null | undefined): RuleBlock | null {
  return code ? (RULE_BLOCK_OF_CODE[code] ?? null) : null;
}

const inForce = (from: string, to: string | null, day: string) => from <= day && (to === null || to >= day);

export function resolveRule(profiles: readonly OwnerFiscalProfile[], policies: readonly OwnerAccountingPolicy[], day: string): RuleResolution {
  const profile = profiles.find((candidate) => inForce(candidate.validFrom, candidate.validTo, day));
  if (!profile) return { ok: false, reason: 'profile_missing' };
  const policy = profile.accountingPolicyId ? policies.find((candidate) => candidate.id === profile.accountingPolicyId) : undefined;
  if (!policy) return { ok: false, reason: 'policy_missing' };
  if (!policy.approved || !policy.parameters) return { ok: false, reason: 'policy_not_approved' };
  if (!inForce(policy.validFrom, policy.validTo, day)) return { ok: false, reason: 'policy_not_effective' };
  if ((profile.taxJurisdiction ?? '').toUpperCase() !== policy.jurisdiction.toUpperCase()) return { ok: false, reason: 'policy_jurisdiction_mismatch' };
  return { ok: true, profile, policy, parameters: policy.parameters };
}

export const PROFILE_OPTIONS = {
  mandateRole: ['owner', 'usufructuary', 'landlord'],
  revenueRecognitionRule: ['cash', 'stay'],
  expenseCommissionModel: ['net_of_commission', 'gross'],
  workingCapitalRule: ['none', 'reserve'],
} as const;

export type ProfileOptionField = keyof typeof PROFILE_OPTIONS;

export function profileGaps(profile: OwnerFiscalProfile): string[] {
  const empty = (value: string | null) => value === null || value.trim() === '';
  const gaps: string[] = [];
  if (empty(profile.legalName)) gaps.push('legalName');
  if (empty(profile.taxResidenceCountry)) gaps.push('taxResidenceCountry');
  if (empty(profile.taxJurisdiction)) gaps.push('taxJurisdiction');
  if (empty(profile.fiscalCode) && empty(profile.vatNumber) && empty(profile.foreignTaxId)) gaps.push('fiscalCode');
  if (empty(profile.settlementCurrency)) gaps.push('settlementCurrency');
  if (empty(profile.revenueRecognitionRule)) gaps.push('revenueRecognitionRule');
  return gaps;
}

export type OwnerReadiness =
  | { ready: true; profile: OwnerFiscalProfile; policy: OwnerAccountingPolicy; from: string }
  | { ready: false; reason: RuleBlock; gaps: string[]; profile: OwnerFiscalProfile | null; policy: OwnerAccountingPolicy | null };

export function ownerReadinessOn(profiles: readonly OwnerFiscalProfile[], policies: readonly OwnerAccountingPolicy[], day: string): OwnerReadiness {
  const profile = profiles.find((candidate) => inForce(candidate.validFrom, candidate.validTo, day)) ?? null;
  if (!profile) return { ready: false, reason: 'profile_missing', gaps: [], profile: null, policy: null };
  const gaps = profileGaps(profile);
  const policy = profile.accountingPolicyId ? (policies.find((candidate) => candidate.id === profile.accountingPolicyId) ?? null) : null;
  if (gaps.length > 0) return { ready: false, reason: 'profile_incomplete', gaps, profile, policy };
  const resolved = resolveRule(profiles, policies, day);
  return resolved.ok
    ? { ready: true, profile: resolved.profile, policy: resolved.policy, from: resolved.profile.validFrom > resolved.policy.validFrom ? resolved.profile.validFrom : resolved.policy.validFrom }
    : { ready: false, reason: resolved.reason, gaps: [], profile, policy };
}

export function latestProfileStart(profiles: readonly Pick<OwnerFiscalProfile, 'validFrom'>[]): string | null {
  return profiles.reduce<string | null>((latest, profile) => (latest === null || profile.validFrom > latest ? profile.validFrom : latest), null);
}

export function maskValue(value: string | null): string | null {
  if (value === null || value === '') return value;
  return value.length <= 4 ? '•'.repeat(value.length) : '•'.repeat(value.length - 4) + value.slice(-4);
}

export interface PayoutIntent {
  ownerId: string;
  statementVersionId: string;
  balance: number;
  paidOn: string;
}

const payoutKeys = new Map<string, string>();

const intentKey = (intent: PayoutIntent): string => [intent.ownerId, intent.statementVersionId, toCents(intent.balance), intent.paidOn].join('|');

/**
 * The key of the request that records a payout: a retry of the same request answers the same payout (the server keeps one payout per key). It belongs to what is asked (the owner,
 * the statement, the balance in cents, the day), not to the dialog that asks it: a retry after a failure, a second click, or the dialog closed and opened again with the same
 * facts send the same key, so a payout whose answer was lost is never recorded twice. It is kept until the server has confirmed the payout (`settlePayoutKey`). A balance that moved (a payout
 * confirmed in between, a correction) is another payout and gets another key.
 */
export function payoutKeyFor(intent: PayoutIntent): string {
  const known = payoutKeys.get(intentKey(intent));
  if (known) return known;
  const created = newIdempotencyKey();
  payoutKeys.set(intentKey(intent), created);
  return created;
}

export function settlePayoutKey(intent: PayoutIntent): void {
  payoutKeys.delete(intentKey(intent));
}

export function forgetPayoutKeys(): void {
  payoutKeys.clear();
}

export interface PayoutForm {
  paidOn: string;
  reference: string;
}

export type PayoutFormErrors = Partial<Record<'paidOn' | 'reference', string>>;

export function buildPayoutCommand(
  form: PayoutForm,
  ctx: Pick<ActionContext, 'ownerId'> & { versionId: string; currency: string; balance: number },
  key: string | ((intent: PayoutIntent) => string),
): { command: OwnerPayoutCommand } | { errors: PayoutFormErrors } {
  const errors: PayoutFormErrors = {};
  if (!/^\d{4}-\d{2}-\d{2}$/.test(form.paidOn)) errors.paidOn = 'ownerAccounting.payout.errors.paidOn';
  if (form.reference.trim().length > 100) errors.reference = 'ownerAccounting.payout.errors.reference';
  if (Object.keys(errors).length > 0) return { errors };

  const idempotencyKey = typeof key === 'string' ? key : key({ ownerId: ctx.ownerId, statementVersionId: ctx.versionId, balance: ctx.balance, paidOn: form.paidOn });
  return {
    command: {
      idempotencyKey,
      ownerId: ctx.ownerId,
      statementVersionId: ctx.versionId,
      currency: ctx.currency,
      paidOn: form.paidOn,
      reference: form.reference.trim() || undefined,
    },
  };
}

// ── The version: what changed since the one before ────────────────────────────────────────────────────────────

export interface VersionChanges {
  added: OwnerLedgerEntry[];
  moved: { key: 'revenue' | 'channelFees' | 'commission' | 'charges' | 'payments' | 'corrections' | 'openingBalance' | 'closingBalance'; before: number; after: number }[];
}

const FIGURES = ['revenue', 'channelFees', 'commission', 'charges', 'payments', 'corrections', 'openingBalance', 'closingBalance'] as const;

export function changesSince(current: OwnerStatementVersion, previous: OwnerStatementVersion, entries: readonly OwnerLedgerEntry[]): VersionChanges {
  const cutoff = new Date(asInstant(previous.cutoffAt)).getTime();
  const added = entries.filter((entry) => new Date(asInstant(entry.postedAt)).getTime() > cutoff);
  const moved = FIGURES.filter((key) => toCents(current[key]) !== toCents(previous[key])).map((key) => ({ key, before: previous[key], after: current[key] }));
  return { added, moved };
}

export function issuesOfVersion(version: Pick<OwnerStatementVersion, 'issuesJson'>): OwnerReadinessIssue[] {
  if (!version.issuesJson) return [];
  try {
    const parsed: unknown = JSON.parse(version.issuesJson);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null && typeof (item as Record<string, unknown>).code === 'string')
      .map((item) => ({
        code: String(item.code),
        ownerId: typeof item.ownerId === 'string' ? item.ownerId : null,
        propertyId: typeof item.propertyId === 'string' ? item.propertyId : null,
        sourceId: typeof item.sourceId === 'string' ? item.sourceId : null,
        blocking: item.blocking !== false,
      }));
  } catch {
    return [];
  }
}

export function sourcePathOf(entry: Pick<OwnerLedgerEntry, 'source' | 'sourceId' | 'sourceReference'>): string | null {
  switch (entry.source) {
    case 'Booking':
      return entry.sourceId ? `/app/short-rent/bookings/${entry.sourceId}` : null;
    case 'Payment': {
      const booking = guidOfCompact(entry.sourceReference);
      return booking ? `/app/short-rent/bookings/${booking}` : entry.sourceId ? `/app/short-rent/payments/${entry.sourceId}` : null;
    }
    case 'WireBatch':
      return '/app/account/wire-transfers';
    default:
      return null;
  }
}

export function paymentPathOf(entry: Pick<OwnerLedgerEntry, 'source' | 'sourceId'>): string | null {
  return entry.source === 'Payment' && entry.sourceId ? `/app/short-rent/payments/${entry.sourceId}` : null;
}

function guidOfCompact(value: string | null | undefined): string | null {
  const hex = /^[0-9a-f]{32}$/i.exec(value ?? '')?.[0];
  return hex ? `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`.toLowerCase() : null;
}

export function attachmentUrlOf(reference: string | null | undefined): string | null {
  if (!reference) return null;
  try {
    const url = new URL(reference);
    return url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

export interface LineSteps {
  credit: boolean;
  shared: boolean;
  sameCurrency: boolean;
  isReversal: boolean;
}

export function stepsOf(entry: OwnerLedgerEntry): LineSteps {
  return {
    credit: entry.amount >= 0,
    shared: entry.sharePercent < 100,
    sameCurrency: entry.originalCurrency === entry.statementCurrency,
    isReversal: entry.reversesEntryId !== null,
  };
}

export function sortedEntries(entries: readonly OwnerLedgerEntry[]): OwnerLedgerEntry[] {
  return [...entries].sort((a, b) => a.recognitionDate.localeCompare(b.recognitionDate) || a.postedAt.localeCompare(b.postedAt) || a.id.localeCompare(b.id));
}

export type FilingLabel = 'calculated' | 'generated' | 'reviewed' | 'submitted' | 'submittedWithoutProof' | 'accepted' | 'acceptedWithoutProof' | 'rejected';

export interface FilingEvidence {
  filingState: TaxFilingState;
  handoffReference: string | null;
  receiptReference: string | null;
  rejectionReason: string | null;
}

const filled = (value: string | null | undefined): boolean => Boolean(value && value.trim().length > 0);

/**
 * The name of a tax file for the person. A file that was only generated (an F24 with its amount, the annual data of the year, an export) is never
 * called «inviato»: that word needs the handoff the person recorded, and «accettato» the receipt of the authority. A state the server sent without
 * its proof says so, and is not the word.
 */
export function filingLabelOf(file: FilingEvidence | null): FilingLabel {
  if (!file) return 'calculated';
  switch (file.filingState) {
    case 'Generated':
      return 'generated';
    case 'Reviewed':
      return 'reviewed';
    case 'Submitted':
      return filled(file.handoffReference) ? 'submitted' : 'submittedWithoutProof';
    case 'Accepted':
      return filled(file.receiptReference) && filled(file.handoffReference) ? 'accepted' : 'acceptedWithoutProof';
    case 'Rejected':
      return 'rejected';
  }
}

export function nextFilingStates(file: FilingEvidence): ('Reviewed' | 'Submitted' | 'Accepted' | 'Rejected')[] {
  switch (file.filingState) {
    case 'Generated':
      return ['Reviewed'];
    case 'Reviewed':
      return ['Submitted'];
    case 'Submitted':
      return ['Accepted', 'Rejected'];
    default:
      return [];
  }
}

export interface TaxYearCheck {
  /** `none`: no withholding and no F24 in the year; `matches`: every F24 is what the withholdings of its month say; `differs`: at least one is not. */
  f24: 'none' | 'matches' | 'differs';
  /** The months where the F24 is not what the withholdings say, or where there are withholdings and no F24 yet. */
  months: { month: number; obligations: number; f24: number | null }[];
  annual: { total: number; matches: boolean } | null;
}

/**
 * The withholdings of the year against the F24 of each month and against the annual data, each on its own: which of the two does not match is what the person needs to know.
 * A year with nothing in it matches nothing (there is nothing to match), and the annual data is compared only when it exists.
 */
export function checkTaxYear(data: Pick<TaxReconciliation, 'obligationsTotal' | 'annualTotal' | 'months'>): TaxYearCheck {
  const months = data.months
    .filter((row) => (row.f24 === null ? toCents(row.obligations) !== 0 : toCents(row.f24) !== toCents(row.obligations)))
    .map((row) => ({ month: row.month, obligations: row.obligations, f24: row.f24 }));
  return {
    f24: data.months.length === 0 ? 'none' : months.length === 0 ? 'matches' : 'differs',
    months,
    annual: data.annualTotal === null ? null : { total: data.annualTotal, matches: toCents(data.annualTotal) === toCents(data.obligationsTotal) },
  };
}

export type TaxYearVerdict = 'empty' | 'reconciled' | 'f24Matches' | 'annualMatches' | 'differs';

/** The one sentence the year gets: «reconciled» only with an F24 that matches and annual data that match; a match that is only half of that says which half. */
export function taxYearVerdict(check: TaxYearCheck): TaxYearVerdict {
  if (check.f24 === 'differs' || (check.annual !== null && !check.annual.matches)) return 'differs';
  if (check.f24 === 'none') return check.annual === null ? 'empty' : 'annualMatches';
  return check.annual === null ? 'f24Matches' : 'reconciled';
}

export const LEDGER_IMMUTABLE_CODE = 'owner_ledger_immutable';

export interface ProblemFacts {
  status: number | undefined;
  code: string | undefined;
  field: string | undefined;
  fields: string[];
  issues: string[];
  figures: { due: number; paid: number; difference: number } | null;
}

export function problemFacts(error: unknown): ProblemFacts {
  const none: ProblemFacts = { status: undefined, code: undefined, field: undefined, fields: [], issues: [], figures: null };
  if (!isAxiosError(error)) return none;
  const data: unknown = error.response?.data;
  const body = typeof data === 'object' && data !== null ? (data as Record<string, unknown>) : {};
  const strings = (value: unknown): string[] => (Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []);
  const number = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) ? value : null);
  const fields = strings(body.fields);
  const due = number(body.due);
  const paid = number(body.paid);
  const difference = number(body.difference);
  return {
    status: error.response?.status,
    code: typeof body.code === 'string' ? body.code : undefined,
    field: typeof body.field === 'string' ? body.field : fields[0],
    fields,
    issues: strings(body.issues),
    figures: due !== null && paid !== null && difference !== null ? { due, paid, difference } : null,
  };
}

export function messageOf(error: unknown, t: TFunction): string {
  return getProblemMessage(error, t) ?? t('ownerAccounting.errors.generic');
}

export function failureText(error: unknown, t: TFunction, exists: (key: string) => boolean): string {
  const message = messageOf(error, t);
  const field = problemFacts(error).field;
  if (!field) return message;
  return t('ownerAccounting.errors.withField', { message, field: fieldNameOf(field, t, exists) });
}

export function fieldNameOf(field: string | null | undefined, t: TFunction, exists: (key: string) => boolean): string {
  if (!field) return '';
  const root = field.split('.')[0] ?? field;
  const key = `ownerAccounting.fields.${root}`;
  return exists(key) ? t(key) : field;
}

/** The key of a payout: a retry of the same request answers the same payout, so it is made once for the dialog and kept while it is open. */
export function newIdempotencyKey(): string {
  return globalThis.crypto?.randomUUID?.() ?? `payout-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export function parseRate(raw: string): number | null {
  const text = raw.trim().replace(',', '.');
  if (!/^\d+(\.\d{1,8})?$/.test(text)) return null;
  const rate = Number(text);
  return rate > 0 ? rate : null;
}

export const shortId = (id: string): string => id.replace(/-/g, '').slice(0, 6).toUpperCase();

export type ActionKey = 'prepare' | 'regenerate' | 'approve' | 'publish' | 'payout' | 'close';

export interface ActionContext {
  period: Period;
  ownerId: string;
  ownerName: string;
  version: OwnerStatementVersion | null;
  versionIds: string[];
}

export function primaryActionOf(actions: RowActions): ActionKey | null {
  if (actions.prepare) return 'prepare';
  if (actions.regenerate) return 'regenerate';
  if (actions.approve) return 'approve';
  if (actions.publish) return 'publish';
  if (actions.payout && !actions.settled) return 'payout';
  if (actions.close) return 'close';
  return null;
}

export function otherActionsOf(actions: RowActions): ActionKey[] {
  const primary = primaryActionOf(actions);
  const all: ActionKey[] = [];
  if (actions.prepare) all.push('prepare');
  if (actions.regenerate) all.push('regenerate');
  if (actions.approve) all.push('approve');
  if (actions.publish) all.push('publish');
  if (actions.payout) all.push('payout');
  if (actions.close) all.push('close');
  return all.filter((action) => action !== primary);
}

export const mandateCovers = (mandate: Pick<OwnerMandate, 'validFrom' | 'validTo'>, day: string): boolean =>
  mandate.validFrom <= day && (mandate.validTo === null || mandate.validTo >= day);

/** What a row of the list of the owners draws of a mandate: the day it starts, the commission and whether the VAT is in it. */
export type MandateTerms = Pick<OwnerMandate, 'validFrom' | 'commissionPercent' | 'commissionIncludesVat'>;

export type MandateState = { kind: 'active'; mandate: MandateTerms } | { kind: 'upcoming'; mandate: MandateTerms } | { kind: 'missing' };

export function mandateStateOn(mandates: readonly OwnerMandate[], day: string): MandateState {
  const ofTheOwner = mandates.filter((mandate) => mandate.ownershipId === null);
  const candidates = ofTheOwner.length > 0 ? ofTheOwner : mandates;
  const inForce = candidates.filter((mandate) => mandateCovers(mandate, day)).sort((a, b) => b.validFrom.localeCompare(a.validFrom))[0];
  if (inForce) return { kind: 'active', mandate: inForce };
  const next = candidates.filter((mandate) => mandate.validFrom > day).sort((a, b) => a.validFrom.localeCompare(b.validFrom))[0];
  return next ? { kind: 'upcoming', mandate: next } : { kind: 'missing' };
}

/**
 * The mandate a row of the list of the owners draws on `day`. The list settles it for an owner whose own mandate is in force (`inForce`, written by the server in the same read as the row): that
 * is the answer and nothing else is read. For every other row the list says nothing, and its `null` is not «no mandate»: a mandate of a single property, or one that starts later, is not in it. The
 * versions of the mandate say what the row shows (`versions`); until they are read nothing is told (`null`), never «missing».
 */
export function mandateOfRow(inForce: OwnerMandateInForce | null | undefined, versions: readonly OwnerMandate[] | undefined, day: string): MandateState | null {
  if (inForce) return { kind: 'active', mandate: inForce };
  return versions ? mandateStateOn(versions, day) : null;
}

/** The start of the newest version of the mandate: a new version must start after it, since the server refuses a day that is not later (409 `owner_mandate_overlap`). */
export function latestMandateStart(mandates: readonly Pick<OwnerMandate, 'validFrom'>[]): string | null {
  return mandates.reduce<string | null>((latest, mandate) => (latest === null || mandate.validFrom > latest ? mandate.validFrom : latest), null);
}

export const MAX_FLAT_FEE = 99_999_999.99;

/**
 * The parts of a statement, in the order of its PDF and its CSV: the stays (the gross without the tourist tax), what the channels kept, the withholding, the commission of the property
 * manager (the VAT its invoice adds is counted with it), the recharges and expenses, the manual corrections, and the payments between the agency and the owner. `other` is a line of a
 * type this client does not know (the server may be newer): it is counted in the total, never dropped, unless the server says it is for information only (`informational`).
 */
export type StatementSection = 'stays' | 'channelFees' | 'withholding' | 'commission' | 'recharges' | 'corrections' | 'payments' | 'other';

const SECTION_OF: Record<OwnerLedgerEntryType, StatementSection> = {
  BookingRevenue: 'stays',
  ChannelFee: 'channelFees',
  ChannelFeeBorneByAgency: 'channelFees',
  Withholding: 'withholding',
  AgencyCommission: 'commission',
  AgencyVat: 'commission',
  OwnerCharge: 'recharges',
  OwnerExpense: 'recharges',
  Correction: 'corrections',
  OwnerPayment: 'payments',
  AgencyPayment: 'payments',
};

/**
 * A line for information only (`ChannelFeeBorneByAgency`: the commission of a portal the agency bears, and the owner is not charged): the server says it (`informational`), and the type that is
 * always one says it too. Such a line is shown with its amount and is NEVER added to a part, to the period, to a balance: the ledger of an owner counts only the lines that count
 * (`OwnerLedgerBalance`), and this client does not know which types do not, so it asks the line.
 */
export const isInformational = (entry: Pick<OwnerLedgerEntry, 'type' | 'informational'>): boolean => entry.informational === true || entry.type === 'ChannelFeeBorneByAgency';

/**
 * An amount of a line as the page writes it. A line for information only is the commission the agency bears, and it is written the way the PDF and the CSV of the statement write it, a positive
 * figure (the ledger holds it as a negative, like a commission of the portal): never with the minus of a deduction, because nothing is deducted. Every other line keeps the sign of the ledger.
 */
export function shownAmount(entry: Pick<OwnerLedgerEntry, 'type' | 'informational'>, amount: number): number {
  if (!isInformational(entry)) return amount;
  return amount === 0 ? 0 : -amount;
}

export interface StatementGroup {
  section: StatementSection;
  amount: number;
  count: number;
  informational: { amount: number; count: number };
}

export interface StatementGroups {
  groups: StatementGroup[];
  period: number;
  payments: StatementGroup;
  opening: number;
  closing: number;
}

const PARTS_IN_ORDER: readonly StatementSection[] = ['stays', 'channelFees', 'withholding', 'commission', 'recharges', 'corrections', 'other'];
const ALWAYS_SHOWN: ReadonlySet<StatementSection> = new Set(['stays', 'channelFees', 'commission', 'recharges']);

/**
 * The lines of a version grouped as its PDF groups them. The amounts are the signed amounts of the lines added up in cents (never as floats), the balances the ones the version stores:
 * nothing here works a commission, a fee or a tax out. A line for information only (`isInformational`) is kept apart: it is counted and written in its part (`informational`) and is in
 * no `amount`, no `count`, and so not in the period either.
 */
export function statementGroupsOf(version: Pick<OwnerStatementVersion, 'openingBalance' | 'closingBalance'>, entries: readonly OwnerLedgerEntry[]): StatementGroups {
  const cents = new Map<StatementSection, { amount: number; count: number; informationalAmount: number; informationalCount: number }>();
  for (const entry of entries) {
    const section = SECTION_OF[entry.type] ?? 'other';
    const current = cents.get(section) ?? { amount: 0, count: 0, informationalAmount: 0, informationalCount: 0 };
    if (isInformational(entry)) {
      cents.set(section, { ...current, informationalAmount: current.informationalAmount + toCents(shownAmount(entry, entry.amount)), informationalCount: current.informationalCount + 1 });
    } else {
      cents.set(section, { ...current, amount: current.amount + toCents(entry.amount), count: current.count + 1 });
    }
  }
  const group = (section: StatementSection): StatementGroup => {
    const found = cents.get(section);
    return {
      section,
      amount: (found?.amount ?? 0) / 100,
      count: found?.count ?? 0,
      informational: { amount: (found?.informationalAmount ?? 0) / 100, count: found?.informationalCount ?? 0 },
    };
  };
  const groups = PARTS_IN_ORDER.map(group).filter((candidate) => ALWAYS_SHOWN.has(candidate.section) || candidate.count > 0 || candidate.informational.count > 0);
  const period = groups.reduce((sum, candidate) => sum + toCents(candidate.amount), 0) / 100;
  return { groups, period, payments: group('payments'), opening: version.openingBalance, closing: version.closingBalance };
}
