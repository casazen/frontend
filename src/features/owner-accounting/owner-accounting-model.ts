import { isAxiosError } from 'axios';
import type { TFunction } from 'i18next';
import type {
  OwnerAccountingPolicy,
  OwnerAccountingRuleParameters,
  OwnerClosePeriodStatus,
  OwnerCloseReadiness,
  OwnerEntityKind,
  OwnerFiscalProfile,
  OwnerFiscalReadiness,
  OwnerLedgerEntry,
  OwnerMandate,
  OwnerPayout,
  OwnerPayoutCommand,
  OwnerPeriodReadiness,
  OwnerReadinessIssue,
  OwnerStatementVersion,
  OwnerStatementVersionStatus,
  TaxFilingState,
  TaxReconciliation,
} from '@/types';
import { getProblemMessage } from '@/lib/api-errors';
import { parseEuroAmount } from '@/lib/euro-amount';
import { addDays, endOfMonth, startOfMonth } from '@/lib/stay-dates';

/** The path of the month-end close (E06/F05/US02/T04): a page of the Amministrazione. */
export const OWNER_CLOSE_PATH = '/app/account/owner-close';

/** The page of one version of an owner's statement. */
export const statementPath = (versionId: string) => `${OWNER_CLOSE_PATH}/versions/${versionId}`;

/** The month-end page on a month (`?period=2026-10`). */
export const closePath = (year: number, month: number) => `${OWNER_CLOSE_PATH}?period=${periodParam({ year, month })}`;

/**
 * The page of the fiscal profile of an owner, with its rule set and the accountant's approval. From the month being closed it carries that month (`?period=2026-10`): the first
 * profile of an owner then starts by default on the first day of it, so the month that sent the person here is covered.
 */
export const ownerFinancialPath = (ownerId: string, period?: Period) => `/app/account/owners/${ownerId}/financial${period ? `?period=${periodParam(period)}` : ''}`;

/** The first day of a month. */
export const startOfPeriod = (period: Period): string => `${periodParam(period)}-01`;

/** Where the facts of an owner that are missing (the registry, the shares, the mandate) are completed: «Inizia con CasaZen», short rent. */
export const OWNER_ONBOARDING_PATH = '/app/short-rent/onboarding';

// ── Periods ───────────────────────────────────────────────────────────────────────────────────────────────────────

export interface Period {
  year: number;
  month: number;
}

export function periodParam({ year, month }: Period): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

/** `2026-10` as a period; the fallback for anything else (a month that does not exist, an empty or hand-made address). */
export function parsePeriod(value: string | null | undefined, fallback: Period): Period {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(value ?? '');
  if (!match) return fallback;
  const year = Number(match[1]);
  return year >= 2000 && year <= 2100 ? { year, month: Number(match[2]) } : fallback;
}

/** The month to close is the one that is over: the month before today (Europe/Rome). */
export function defaultPeriod(today: string): Period {
  const lastOfPrevious = addDays(startOfMonth(today), -1);
  return { year: Number(lastOfPrevious.slice(0, 4)), month: Number(lastOfPrevious.slice(5, 7)) };
}

export function shiftPeriod({ year, month }: Period, months: number): Period {
  const index = year * 12 + (month - 1) + months;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

/** The month is over when its last day is before today: closing it earlier would leave out what is paid after the close. */
export function isPeriodOver({ year, month }: Period, today: string): boolean {
  return endOfMonth(`${year}-${String(month).padStart(2, '0')}-01`) < today;
}

// ── Money ─────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Euros and cents as whole cents: amounts are compared in cents, never as floats. */
export const toCents = (amount: number): number => Math.round(amount * 100);

/** The locale of the amounts and the dates: the language of the app, with the English of the United Kingdom. */
export const localeOf = (language: string): string => (language.startsWith('en') ? 'en-GB' : 'it-IT');

/** An instant of the API (UTC, with or without its `Z`) as a date and a time in Europe/Rome. */
export function asInstant(value: string): string {
  return value.includes('T') && !/(?:Z|[+-]\d{2}(?::?\d{2})?)$/i.test(value) ? `${value}Z` : value;
}

// ── The month: who is where, and what is wrong ────────────────────────────────────────────────────────────────

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
      // No version yet, or only a superseded one (it never is the latest): the statement is still to be made.
      return 'toPrepare';
  }
}

/**
 * The codes that say where the statement stands (not made, not approved, closed), not what is wrong with it: the group tells them. They are not
 * anomalies, and a month with nothing else to fix is ready for the next step.
 */
const LIFECYCLE_CODES: ReadonlySet<string> = new Set(['statement_missing', 'statement_not_approved', 'period_closed']);

/** The anomalies of the month: every issue that is not a step of the statement itself. */
export function anomaliesOf(issues: readonly OwnerReadinessIssue[]): OwnerReadinessIssue[] {
  return issues.filter((issue) => !LIFECYCLE_CODES.has(issue.code));
}

export const blockingAnomalies = (issues: readonly OwnerReadinessIssue[]): OwnerReadinessIssue[] => anomaliesOf(issues).filter((issue) => issue.blocking);

/**
 * The same fact as the server tells it twice: an issue of a property that no owner is credited for is listed under the month, and again under every
 * owner of that property (it holds back each of their statements). A person counts and reads it once.
 */
const issueKey = (issue: OwnerReadinessIssue): string => `${issue.code}|${issue.propertyId ?? ''}|${issue.sourceId ?? ''}`;

export interface CloseSummary {
  owners: number;
  /** Owners with no blocking anomaly. */
  ready: number;
  /** `ready` out of `owners`, rounded; 0 with no owner. */
  percent: number;
  closed: number;
  /** Blocking anomalies of the owners, plus the ones of the org. */
  blocking: number;
  /** Anomalies that do not block (a negative balance, a source that arrived after the close). */
  warnings: number;
  /** Blocking anomalies that belong to no owner: a source with nobody to credit. */
  orgBlocking: number;
  groups: Record<OwnerGroup, number>;
}

/** What the page says at the top: how many statements are ready to go on, and how many anomalies stop the others. */
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
    // An issue of a property holds back the owner (not ready) even though it is counted once, under the month.
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
  /** The owner it is about; `null` for an issue of the whole month (a source nobody is credited for). */
  ownerId: string | null;
  code: string;
  blocking: boolean;
  /** How many issues of this code the owner has (twelve payments not posted are one line, «12»). */
  count: number;
  /** The first of them: what its action opens. */
  issue: OwnerReadinessIssue;
}

/** The anomalies of the month as lines a person reads: one for each owner and code, the blocking ones first, an issue of a property only once. */
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

/** The owners of a group, by the order the server sent them (by id): the page sorts them by name. */
export function ownersOf(readiness: OwnerCloseReadiness, group: OwnerGroup): OwnerPeriodReadiness[] {
  return readiness.owners.filter((owner) => groupOf(owner.latestStatus) === group);
}

/** How an issue is resolved: the button or the page that does it. Nothing here resolves one on its own. */
export type IssueAction =
  | { kind: 'post' }
  | { kind: 'prepare' }
  | { kind: 'regenerate' }
  | { kind: 'approve' }
  | { kind: 'fx' }
  | { kind: 'correction' }
  | { kind: 'profile' }
  | { kind: 'onboarding' }
  | { kind: 'payment'; paymentId: string }
  | { kind: 'none' };

/** Every code the API sends for the readiness of the month (besides the unknown ones of a later version, which say so in words of their own). */
export const ISSUE_CODES = [
  'duplicate_entry',
  'fx_missing',
  'currency_mixed',
  'ledger_statement_imbalance',
  'late_source_after_close',
  'negative_balance',
  'owner_fiscal_policy_jurisdiction_mismatch',
  'owner_fiscal_policy_missing',
  'owner_fiscal_policy_not_approved',
  'owner_fiscal_policy_not_effective',
  'owner_fiscal_profile_incomplete',
  'owner_fiscal_profile_missing',
  'ownership_missing',
  'ownership_share_gap',
  'period_closed',
  'period_dirty',
  'source_amount_missing',
  'statement_missing',
  'statement_not_approved',
  'unposted_source',
] as const;

export type IssueCode = (typeof ISSUE_CODES)[number];

/** `fx_missing` → `fxMissing`: the key of the texts of the code. */
export function camelCode(code: string): string {
  const [first = '', ...rest] = code.toLowerCase().split('_').filter(Boolean);
  return first + rest.map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join('');
}

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
    case 'period_dirty':
    case 'ledger_statement_imbalance':
      return { kind: 'regenerate' };
    case 'statement_not_approved':
      return { kind: 'approve' };
    case 'fx_missing':
      return { kind: 'fx' };
    case 'late_source_after_close':
      return { kind: 'correction' };
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
    case 'source_amount_missing':
      return issue.sourceId ? { kind: 'payment', paymentId: issue.sourceId } : { kind: 'none' };
    default:
      return { kind: 'none' };
  }
}

// ── What a row of the month may do ────────────────────────────────────────────────────────────────────────────

export interface RowActions {
  /** Make the statement (there is none). */
  prepare: boolean;
  /** Make a new version: the ledger changed after the last one, or its anomalies were resolved. */
  regenerate: boolean;
  approve: boolean;
  publish: boolean;
  payout: boolean;
  close: boolean;
  /** The month cannot be closed yet because it is not over. */
  closeWaitsForTheEnd: boolean;
  /** The ledger changed after the version: it cannot be approved or published as it is, a new version is needed. */
  stale: boolean;
  /** The confirmed payouts already cover what the statement says is owed: paying again is not the next step, closing the month is. */
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
  /** The payments already cover the balance (`isSettled`); unknown (the payments not read yet) is `false`. */
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

/**
 * Nothing is left to pay on the statement: the confirmed payouts of the month cover what it says is owed (the difference is not positive: it is paid, or there is nothing owed).
 * Then the next step is the close, and a payment is only an extra one.
 */
export function isSettled(version: Pick<OwnerStatementVersion, 'closingBalance' | 'currency'>, payouts: readonly OwnerPayout[], versionIds: readonly string[]): boolean {
  return toCents(previewReconciliation(version, payouts, versionIds).difference) <= 0;
}

// ── Reconciliation ───────────────────────────────────────────────────────────────────────────────────────────

export interface ReconciliationPreview {
  /** What the approved closing balance says is owed. */
  due: number;
  /** What the confirmed payouts of the month's versions settle, in the currency of the version. */
  paid: number;
  difference: number;
  /** The month does not reconcile, or the balance is negative: closing needs a reason and the finance permission. */
  needsWaiver: boolean;
  /** No confirmed payout: the close counts the wires marked as paid, which this page cannot see, so `paid` is a floor. */
  wiresCountInstead: boolean;
  payouts: OwnerPayout[];
}

/**
 * The reconciliation the close will make, as far as the page can see it: the closing balance of the version against the gross of the confirmed
 * payouts of the month's versions. The close reads it again on the server and answers with its own figures (`owner_close_unreconciled`): those
 * are the ones that count.
 */
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

// ── The rule that decides a payout ───────────────────────────────────────────────────────────────────────────

export type RuleBlock = 'profile_missing' | 'profile_incomplete' | 'policy_missing' | 'policy_not_approved' | 'policy_not_effective' | 'policy_jurisdiction_mismatch';

export type RuleResolution =
  | { ok: true; profile: OwnerFiscalProfile; policy: OwnerAccountingPolicy; parameters: OwnerAccountingRuleParameters }
  | { ok: false; reason: RuleBlock };

/** The rule a payout asks its facts from, as the server found it for the day (no profile: its values are not read for it). */
export type PayoutRule =
  | { ok: true; policy: OwnerAccountingPolicy; parameters: OwnerAccountingRuleParameters }
  | { ok: false; reason: RuleBlock };

const RULE_BLOCK_OF_CODE: Readonly<Record<string, RuleBlock>> = {
  owner_fiscal_profile_missing: 'profile_missing',
  owner_fiscal_profile_incomplete: 'profile_incomplete',
  owner_fiscal_policy_missing: 'policy_missing',
  owner_fiscal_policy_not_approved: 'policy_not_approved',
  owner_fiscal_policy_not_effective: 'policy_not_effective',
  owner_fiscal_policy_jurisdiction_mismatch: 'policy_jurisdiction_mismatch',
};

/**
 * What the server says blocks the owner on a day: the `owner_fiscal_*` code of the 422 of `…/fiscal-profiles/readiness`. `null` for anything else (a network error, a 5xx, no
 * answer): that is not a verdict on the owner and is told as a failure to read, never as a rule that is missing.
 */
export function ruleBlockOf(error: unknown): RuleBlock | null {
  const { status, code } = problemFacts(error);
  return status === 422 && code !== undefined ? (RULE_BLOCK_OF_CODE[code] ?? null) : null;
}

/**
 * The rule set the server chose for the owner on the day, with its parameters from the rule sets of the agency. The decision is the server's (the profile, its missing facts, the
 * approval, the days it is in force, the jurisdiction): this only finds the parameters of the rule it named, to ask the facts the rule needs.
 */
export function payoutRuleOf(found: Pick<OwnerFiscalReadiness, 'policyId'>, policies: readonly OwnerAccountingPolicy[]): PayoutRule {
  const policy = policies.find((candidate) => candidate.id === found.policyId);
  if (!policy) return { ok: false, reason: 'policy_missing' };
  if (!policy.approved || !policy.parameters) return { ok: false, reason: 'policy_not_approved' };
  return { ok: true, policy, parameters: policy.parameters };
}

const inForce = (from: string, to: string | null, day: string) => from <= day && (to === null || to >= day);

/**
 * The profile of the owner and the approved rule set that apply on a day, as the server finds them before it decides a payout. The page needs it
 * to ask only the facts the rule needs (and to say what is missing before the person fills a form that would be refused); the server resolves it
 * again, and its answer is the one that counts. Nothing here knows a rate, a code or a jurisdiction: they are the ones the rule set says.
 */
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

/** The values the profile offers for the fields that are codes: the ones the accounting knows. A value stored outside the list stays in it. */
export const PROFILE_OPTIONS = {
  mandateRole: ['owner', 'usufructuary', 'landlord'],
  revenueRecognitionRule: ['cash', 'stay'],
  expenseCommissionModel: ['net_of_commission', 'gross'],
  workingCapitalRule: ['none', 'reserve'],
} as const;

export type ProfileOptionField = keyof typeof PROFILE_OPTIONS;

/**
 * What a profile still needs to be used (the same six facts the server asks): the legal name, the tax residence, the jurisdiction, one fiscal
 * identifier, the settlement currency and the revenue recognition rule. A masked value still says whether there is one, so the answer is the same
 * for who sees the values in full and who does not.
 */
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
  /** `from`: the day from which the profile in force and its rule set both apply. Months before it are not covered by this data, whatever today says. */
  | { ready: true; profile: OwnerFiscalProfile; policy: OwnerAccountingPolicy; from: string }
  | { ready: false; reason: RuleBlock; gaps: string[]; profile: OwnerFiscalProfile | null; policy: OwnerAccountingPolicy | null };

/**
 * Whether the owner can be used on a day, in the order the server decides it: the profile in force, its missing facts, then its rule set (chosen,
 * approved by the accountant, in force, of the jurisdiction of the profile). It says what blocks and where; it never decides a tax.
 */
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

/** The newest start among the profiles of an owner: a new profile must start after it (a day that is not later is refused, 409 `owner_fiscal_profile_overlap`). */
export function latestProfileStart(profiles: readonly Pick<OwnerFiscalProfile, 'validFrom'>[]): string | null {
  return profiles.reduce<string | null>((latest, profile) => (latest === null || profile.validFrom > latest ? profile.validFrom : latest), null);
}

/** The last four characters of a value and a dot for each one before them: how a value that was received in full is shown until the person asks for it. */
export function maskValue(value: string | null): string | null {
  if (value === null || value === '') return value;
  return value.length <= 4 ? '•'.repeat(value.length) : '•'.repeat(value.length - 4) + value.slice(-4);
}

/** What a payout is, for its key: who is paid, on which version of the statement, how much and on which day. */
export interface PayoutIntent {
  ownerId: string;
  statementVersionId: string;
  grossAmount: number;
  paidOn: string;
}

const payoutKeys = new Map<string, string>();

const intentKey = (intent: PayoutIntent): string => [intent.ownerId, intent.statementVersionId, toCents(intent.grossAmount), intent.paidOn].join('|');

/**
 * The key of the request that records a payout: a retry of the same request answers the same payout (the server keeps one payout per key). It belongs to what is asked (the owner,
 * the statement, the amount in cents, the day), not to the dialog that asks it: a retry after a failure, a second click, or the dialog closed and opened again with the same
 * facts send the same key, so a payout whose answer was lost is never recorded twice. It is kept until the server has confirmed the payout (`settlePayoutKey`).
 */
export function payoutKeyFor(intent: PayoutIntent): string {
  const known = payoutKeys.get(intentKey(intent));
  if (known) return known;
  const created = newIdempotencyKey();
  payoutKeys.set(intentKey(intent), created);
  return created;
}

/** The payout was confirmed: the same facts asked again are another payout (two payments of the same amount on the same day), with another key. */
export function settlePayoutKey(intent: PayoutIntent): void {
  payoutKeys.delete(intentKey(intent));
}

/** Forgets every key not yet confirmed (the tests start from none). */
export function forgetPayoutKeys(): void {
  payoutKeys.clear();
}

/** The amount is more than what is left to pay on the statement (`left`: the approved balance less the confirmed payouts; nothing left is 0). */
export function exceedsWhatIsLeft(left: number | null, gross: number | null): boolean {
  return left !== null && gross !== null && toCents(gross) > Math.max(toCents(left), 0);
}

export interface PayoutForm {
  gross: string;
  paidOn: string;
  reference: string;
  agencyCollected: '' | 'yes' | 'no';
  qualifyingShortLet: '' | 'yes' | 'no';
  /** One amount for each component the rule counts in the gross base, by its code. */
  components: Record<string, string>;
}

export type PayoutFormErrors = Partial<Record<'gross' | 'paidOn' | 'reference' | 'agencyCollected' | 'qualifyingShortLet' | 'components', string>>;

/**
 * The payout the form describes, or what is wrong with it (the keys of the texts). The facts the rule needs are asked and never defaulted: a
 * question left unanswered is an error, not «no». The withholding is not computed here: the server decides it, on the approved rule, when the
 * payout is confirmed.
 */
export function buildPayoutCommand(
  form: PayoutForm,
  ctx: Pick<ActionContext, 'ownerId'> & { versionId: string; currency: string },
  parameters: OwnerAccountingRuleParameters,
  /** The key of the request, or what makes it from the facts of the payout (`payoutKeyFor`): the amount is known only once the form is valid. */
  key: string | ((intent: PayoutIntent) => string),
): { command: OwnerPayoutCommand } | { errors: PayoutFormErrors } {
  const errors: PayoutFormErrors = {};
  const gross = parseEuroAmount(form.gross);
  if (gross === null || gross <= 0) errors.gross = 'ownerAccounting.payout.errors.gross';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(form.paidOn)) errors.paidOn = 'ownerAccounting.payout.errors.paidOn';
  if (form.reference.trim().length > 100) errors.reference = 'ownerAccounting.payout.errors.reference';

  const needsCollection = parameters.withholdingApplies && parameters.requiresAgencyCollection;
  const needsContract = parameters.withholdingApplies && parameters.requiresQualifyingShortLet;
  if (needsCollection && form.agencyCollected === '') errors.agencyCollected = 'ownerAccounting.payout.errors.answer';
  if (needsContract && form.qualifyingShortLet === '') errors.qualifyingShortLet = 'ownerAccounting.payout.errors.answer';

  const components: Record<string, number> = {};
  if (parameters.withholdingApplies) {
    for (const code of parameters.grossBaseComponents) {
      const amount = parseEuroAmount(form.components[code] ?? '');
      if (amount === null || amount < 0) errors.components = 'ownerAccounting.payout.errors.components';
      else components[code] = amount;
    }
  }

  if (Object.keys(errors).length > 0 || gross === null) return { errors };
  const idempotencyKey = typeof key === 'string' ? key : key({ ownerId: ctx.ownerId, statementVersionId: ctx.versionId, grossAmount: gross, paidOn: form.paidOn });
  return {
    command: {
      idempotencyKey,
      ownerId: ctx.ownerId,
      statementVersionId: ctx.versionId,
      grossAmount: gross,
      currency: ctx.currency,
      paidOn: form.paidOn,
      reference: form.reference.trim() || undefined,
      agencyCollected: needsCollection ? form.agencyCollected === 'yes' : null,
      qualifyingShortLet: needsContract ? form.qualifyingShortLet === 'yes' : null,
      components: parameters.withholdingApplies ? components : undefined,
    },
  };
}

// ── The version: what changed since the one before ────────────────────────────────────────────────────────────

export interface VersionChanges {
  /** The lines posted after the cut-off of the previous version: what is new in this one. */
  added: OwnerLedgerEntry[];
  /** The figures that moved, each with what it was and what it is. */
  moved: { key: 'revenue' | 'channelFees' | 'commission' | 'charges' | 'payments' | 'corrections' | 'openingBalance' | 'closingBalance'; before: number; after: number }[];
}

const FIGURES = ['revenue', 'channelFees', 'commission', 'charges', 'payments', 'corrections', 'openingBalance', 'closingBalance'] as const;

/** Which lines and which figures differ from the previous version of the same month: ledger lines are never edited, so a change is a line posted later. */
export function changesSince(current: OwnerStatementVersion, previous: OwnerStatementVersion, entries: readonly OwnerLedgerEntry[]): VersionChanges {
  const cutoff = new Date(asInstant(previous.cutoffAt)).getTime();
  const added = entries.filter((entry) => new Date(asInstant(entry.postedAt)).getTime() > cutoff);
  const moved = FIGURES.filter((key) => toCents(current[key]) !== toCents(previous[key])).map((key) => ({ key, before: previous[key], after: current[key] }));
  return { added, moved };
}

/** The issues the server stored on a version when it generated it (blocking ones made it «Flagged»). */
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

// ── A line of the ledger ─────────────────────────────────────────────────────────────────────────────────────

/** Where the page that shows the source of a line is: a booking, a payment, the wire transfers; none for a charge or a manual line (they carry their own text). */
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

/** The payment of a line of revenue, when the line comes from one. */
export function paymentPathOf(entry: Pick<OwnerLedgerEntry, 'source' | 'sourceId'>): string | null {
  return entry.source === 'Payment' && entry.sourceId ? `/app/short-rent/payments/${entry.sourceId}` : null;
}

/** `0b1c…` (32 hex digits, no hyphens) as the guid the booking page takes; `null` for anything else. */
function guidOfCompact(value: string | null | undefined): string | null {
  const hex = /^[0-9a-f]{32}$/i.exec(value ?? '')?.[0];
  return hex ? `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`.toLowerCase() : null;
}

/** An address of the attachment of a charge or a correction that is safe to open (https only); anything else is shown as text. */
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
  /** The line is credited to the owner (positive) or debited (negative). */
  credit: boolean;
  /** The line is the owner's share of the source (the share is under 100%). */
  shared: boolean;
  /** The source and the statement are in the same currency: no rate is applied. */
  sameCurrency: boolean;
  /** The line undoes an earlier one. */
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

/** The lines of a version in the order a reader follows them: by the day they count for, then by when they were posted. */
export function sortedEntries(entries: readonly OwnerLedgerEntry[]): OwnerLedgerEntry[] {
  return [...entries].sort((a, b) => a.recognitionDate.localeCompare(b.recognitionDate) || a.postedAt.localeCompare(b.postedAt) || a.id.localeCompare(b.id));
}

// ── Tax files: calculated, generated, reviewed, submitted, accepted ───────────────────────────────────────

/** What a tax file may be called. `submitted` and `accepted` need the proof (the handoff and the receipt): without it the file is never called so. */
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

/** The moves a file can make from where it is (the same chain the server allows: it answers 409 for any other). */
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

// ── The year of the withholdings against the F24 and the annual data ───────────────────────────────────────

/** What the year's reconciliation says, told for each of the two things the withholdings are checked against. */
export interface TaxYearCheck {
  /** `none`: no withholding and no F24 in the year; `matches`: every F24 is what the withholdings of its month say; `differs`: at least one is not. */
  f24: 'none' | 'matches' | 'differs';
  /** The months where the F24 is not what the withholdings say, or where there are withholdings and no F24 yet. */
  months: { month: number; obligations: number; f24: number | null }[];
  /** The annual data of the year with whether it is what the withholdings of the year say; `null` while there is none (then nothing is said about it). */
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

// ── Errors ───────────────────────────────────────────────────────────────────────────────────────────────────

export interface ProblemFacts {
  status: number | undefined;
  code: string | undefined;
  /** The field the server names (`field`), or the first of `fields`. */
  field: string | undefined;
  fields: string[];
  /** The blocking issues of a refused close (`issues`: the codes). */
  issues: string[];
  /** The figures of a close that does not reconcile. */
  figures: { due: number; paid: number; difference: number } | null;
}

/** What the server says about a refusal, beside its text: the stable code and the extensions of the problem (`field`, `issues`, `due`, `paid`, `difference`). */
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

/** The text of a failed call for the person: the translated code or the sentence of the server, else the generic one of the page. */
export function messageOf(error: unknown, t: TFunction): string {
  return getProblemMessage(error, t) ?? t('ownerAccounting.errors.generic');
}

/**
 * The text of a refused write for a dialog: what the server says, and the field it names (`field` of a 422) in the words of the form. A name the
 * app has no words for is shown as it came: the person can still tell which one the server means.
 */
export function failureText(error: unknown, t: TFunction, exists: (key: string) => boolean): string {
  const message = messageOf(error, t);
  const field = problemFacts(error).field;
  if (!field) return message;
  const root = field.split('.')[0] ?? field;
  const key = `ownerAccounting.fields.${root}`;
  return t('ownerAccounting.errors.withField', { message, field: exists(key) ? t(key) : field });
}

/** The key of a payout: a retry of the same request answers the same payout, so it is made once for the dialog and kept while it is open. */
export function newIdempotencyKey(): string {
  return globalThis.crypto?.randomUUID?.() ?? `payout-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

/** An exchange rate typed with a comma or a dot, at most eight decimals as the API stores it; `null` for anything that is not a positive number. */
export function parseRate(raw: string): number | null {
  const text = raw.trim().replace(',', '.');
  if (!/^\d+(\.\d{1,8})?$/.test(text)) return null;
  const rate = Number(text);
  return rate > 0 ? rate : null;
}

/** The first characters of an id, for a person who has no name to show. */
export const shortId = (id: string): string => id.replace(/-/g, '').slice(0, 6).toUpperCase();

/** The steps a person can ask for on an owner's month. */
export type ActionKey = 'prepare' | 'regenerate' | 'approve' | 'publish' | 'payout' | 'close';

/** What the actions of an owner's month need to know: the month, the owner and the version they work on. */
export interface ActionContext {
  period: Period;
  ownerId: string;
  ownerName: string;
  /** The latest version that is not superseded; `null` while there is none. */
  version: OwnerStatementVersion | null;
  /** Every version of the month: the payouts of the month are the ones made on any of them. */
  versionIds: string[];
}

/** Which action the person should take next, if any: the one the row of the month puts forward. The others are in its menu. */
export function primaryActionOf(actions: RowActions): ActionKey | null {
  if (actions.prepare) return 'prepare';
  if (actions.regenerate) return 'regenerate';
  if (actions.approve) return 'approve';
  if (actions.publish) return 'publish';
  // A statement that is already paid is not asked to be paid again: the close is the next step (or nothing, while the month is not over).
  if (actions.payout && !actions.settled) return 'payout';
  if (actions.close) return 'close';
  return null;
}

/** The actions in the order of the menu, without the one that is already the button. */
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

// ── The mandate of an owner (E13/F02/US01/T01) ────────────────────────────────────────────────────────────────

/** True when the version is in force on `day` (`yyyy-MM-dd`, its first and last day included): the one definition the server applies (`OwnerMandateRules.Covers`). */
export const mandateCovers = (mandate: Pick<OwnerMandate, 'validFrom' | 'validTo'>, day: string): boolean =>
  mandate.validFrom <= day && (mandate.validTo === null || mandate.validTo >= day);

/** The mandate of an owner on a day: the version in force, or the first one that starts later, or none. The page never says «none» for a mandate it could not read. */
export type MandateState = { kind: 'active'; mandate: OwnerMandate } | { kind: 'upcoming'; mandate: OwnerMandate } | { kind: 'missing' };

/**
 * Which version of the mandate applies to an owner on `day`: the one in force (the latest start when more are, as the server decides), else the first one that starts after it, else
 * none. The versions the API writes cover every property of the owner; one of a single ownership, of before E13, is looked at only when the owner has none of its own.
 */
export function mandateStateOn(mandates: readonly OwnerMandate[], day: string): MandateState {
  const ofTheOwner = mandates.filter((mandate) => mandate.ownershipId === null);
  const candidates = ofTheOwner.length > 0 ? ofTheOwner : mandates;
  const inForce = candidates.filter((mandate) => mandateCovers(mandate, day)).sort((a, b) => b.validFrom.localeCompare(a.validFrom))[0];
  if (inForce) return { kind: 'active', mandate: inForce };
  const next = candidates.filter((mandate) => mandate.validFrom > day).sort((a, b) => a.validFrom.localeCompare(b.validFrom))[0];
  return next ? { kind: 'upcoming', mandate: next } : { kind: 'missing' };
}

/** The start of the newest version of the mandate: a new version must start after it, since the server refuses a day that is not later (409 `owner_mandate_overlap`). */
export function latestMandateStart(mandates: readonly Pick<OwnerMandate, 'validFrom'>[]): string | null {
  return mandates.reduce<string | null>((latest, mandate) => (latest === null || mandate.validFrom > latest ? mandate.validFrom : latest), null);
}

/** The highest flat fee the server stores (`decimal(10,2)`): above it is a typing mistake (422 `owner_mandate_invalid`). */
export const MAX_FLAT_FEE = 99_999_999.99;

/** What the list of the owners shows of a fiscal profile: its kind and its settlement currency (`null` while the profile has none). Nothing else of the profile is kept. */
export interface OwnerProfileFacts {
  entityKind: OwnerEntityKind;
  settlementCurrency: string | null;
}

/**
 * The kind and the settlement currency of the profile in force on `day` (the newest when none is in force, as the page of the owner does), or `null` for an owner with no profile. The profile
 * comes with the identifiers, the address and the bank account of the owner: the list reduces it to these two facts as soon as it is read, so none of them reaches the cache of the
 * queries.
 */
export function profileFactsOf(profiles: readonly OwnerFiscalProfile[], day: string): OwnerProfileFacts | null {
  const profile = profiles.find((candidate) => candidate.validFrom <= day && (candidate.validTo === null || candidate.validTo >= day)) ?? profiles[0];
  return profile ? { entityKind: profile.entityKind, settlementCurrency: profile.settlementCurrency } : null;
}
