import type { TFunction } from 'i18next';
import { translateErrorCode } from '@/lib/api-errors';
import { OWNER_BULK_ACTIONS, type OwnerBulkAction, type OwnerBulkOwnerResult, type OwnerBulkRun, type OwnerCloseReadiness } from '@/types';
import {
  CHANNEL_COMMISSIONS_PATH,
  OWNER_ONBOARDING_PATH,
  actionForIssue,
  camelCode,
  isKnownIssue,
  ownerFinancialPath,
  type CloseSummary,
  type Period,
} from './owner-accounting-model';

// ── The step ──────────────────────────────────────────────────────────────────────────────────────────────────────

/** Whether a value that came back from a field is one of the steps. */
export function isBulkAction(value: string): value is OwnerBulkAction {
  return (OWNER_BULK_ACTIONS as readonly string[]).includes(value);
}

/**
 * The step the month asks for next, to open the dialog on (the person can choose another): the posting while a source is not in the ledger, then the statements still to make, the ones to
 * approve, the ones approved and not yet published, and, once the month is over, the close. A month with nothing left to do starts on the posting, which changes nothing that is already there.
 */
export function suggestedBulkAction(readiness: OwnerCloseReadiness, summary: CloseSummary, monthOver: boolean): OwnerBulkAction {
  const issues = [...readiness.issues, ...readiness.owners.flatMap((owner) => owner.issues)];
  if (issues.some((issue) => actionForIssue(issue).kind === 'post')) return 'Post';
  if (summary.groups.toPrepare > 0) return 'Generate';
  if (summary.groups.toVerify > 0) return 'Approve';
  if (summary.groups.approved > 0) return 'Publish';
  if (monthOver && summary.closed < summary.owners) return 'Close';
  return 'Post';
}

// ── What a run says ───────────────────────────────────────────────────────────────────────────────────────────────

/**
 * A run goes on while the server says so (`Queued`, `Running`). Anything else is over: a status a later server adds is never waited for for ever, and never read as a success
 * ({@link verdictOf} says «fatto» only for `Completed`).
 */
export function isRunOver(run: Pick<OwnerBulkRun, 'status'>): boolean {
  return run.status !== 'Queued' && run.status !== 'Running';
}

/** The code the server puts on a row that is `ok` when the version it made carries anomalies: the statement exists, and it cannot be approved until they are resolved. */
const FLAGGED_CODE = 'owner_statement_flagged';

/**
 * What a row is for the person: `failed` (the step was not done: always listed with its reason), `flagged` (done, but the version has anomalies: listed with them), `done` (done now) or
 * `unchanged` (already where the step leads).
 */
export type RowKind = 'failed' | 'flagged' | 'done' | 'unchanged';

export function rowKindOf(row: Pick<OwnerBulkOwnerResult, 'ok' | 'code' | 'unchanged'>): RowKind {
  if (!row.ok) return 'failed';
  if (row.code === FLAGGED_CODE) return 'flagged';
  return row.unchanged ? 'unchanged' : 'done';
}

export interface BulkTally {
  /** The owners the run was asked for. */
  total: number;
  /** The owners it has answered so far. */
  answered: number;
  done: number;
  unchanged: number;
  flagged: number;
  failed: number;
}

/** The rows of a run counted by what they are: the numbers are the rows', never a total the server says. */
export function tallyOf(run: Pick<OwnerBulkRun, 'total' | 'results'>): BulkTally {
  const tally: BulkTally = { total: run.total, answered: run.results.length, done: 0, unchanged: 0, flagged: 0, failed: 0 };
  for (const row of run.results) tally[rowKindOf(row)] += 1;
  return tally;
}

/**
 * What a run comes to, for the line on top of its result. `allDone` only when the run is over, it is `Completed`, every owner it was asked for has a row and not one is a failure or carries
 * anomalies: anything else says what is missing. A run that is over without a row for every owner is `incomplete`, never «fatto».
 */
export type BulkVerdict = 'running' | 'runFailed' | 'someNotDone' | 'incomplete' | 'doneWithFlags' | 'empty' | 'allDone';

export function verdictOf(run: OwnerBulkRun): BulkVerdict {
  if (!isRunOver(run)) return 'running';
  if (run.status !== 'Completed') return 'runFailed';
  const tally = tallyOf(run);
  if (tally.failed > 0) return 'someNotDone';
  if (tally.answered < tally.total) return 'incomplete';
  if (tally.total === 0) return 'empty';
  if (tally.flagged > 0) return 'doneWithFlags';
  return 'allDone';
}

/**
 * The line on top of the result of a run, in words: what it comes to from its rows ({@link verdictOf}). They are also the words of the toast that tells how a run went when the dialog
 * was left while it went on, so the screen and the toast never say two different things about the same run.
 */
export function headlineOf(run: OwnerBulkRun, t: TFunction): string {
  const tally = tallyOf(run);
  const step = t(`ownerAccounting.bulk.step.${run.action}.label`);
  switch (verdictOf(run)) {
    case 'allDone':
      return t('ownerAccounting.bulk.result.headline.allDone', { count: tally.total, step });
    case 'doneWithFlags':
      return t('ownerAccounting.bulk.result.headline.doneWithFlags', { count: tally.flagged, step });
    case 'someNotDone':
      return t('ownerAccounting.bulk.result.headline.someNotDone', { count: tally.failed, total: tally.total, step });
    case 'incomplete':
      return t('ownerAccounting.bulk.result.headline.incomplete', { count: tally.answered, total: tally.total, step });
    case 'empty':
      return t('ownerAccounting.bulk.result.headline.empty', { step });
    case 'runFailed':
      return t('ownerAccounting.bulk.result.headline.runFailed', { step });
    case 'running':
      return t('ownerAccounting.bulk.progress.text', { count: tally.answered, total: tally.total });
  }
}

/** How far a run is, from 0 to 100: the owners answered out of the owners asked for. */
export function progressPercent(run: Pick<OwnerBulkRun, 'total' | 'results'>): number {
  return run.total <= 0 ? 0 : Math.min(100, Math.round((run.results.length / run.total) * 100));
}

// ── The words of a row ────────────────────────────────────────────────────────────────────────────────────────────

/**
 * The words for a code of a row. The codes a month-end step answers with are the ones of the readiness (an owner kept out of the ledger: `ownerAccounting.issue`) and the refusals of the
 * server (`apiErrors.codes`); a few have words of the bulk step (`ownerAccounting.bulk.reason`: the close that does not reconcile is not waived from here). A code the app does not know is
 * shown as it came: never a blank, never a success.
 */
export function codeWords(code: string, t: TFunction, exists: (key: string) => boolean): string {
  const key = camelCode(code);
  const own = `ownerAccounting.bulk.reason.${key}`;
  if (exists(own)) return t(own);
  if (isKnownIssue(code)) return t(`ownerAccounting.issue.${key}.title`);
  return translateErrorCode(code, t) ?? t('ownerAccounting.bulk.result.unknownCode', { code });
}

export interface BulkFigures {
  due: number;
  paid: number;
  difference: number;
}

/** The figures of a close that does not reconcile (`details`): amounts with no currency, so they are shown without a symbol and with the words that say so. `null` when the row has none. */
export function figuresOf(row: Pick<OwnerBulkOwnerResult, 'details'>): BulkFigures | null {
  const details = row.details;
  if (!details) return null;
  const amount = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) ? value : null);
  const due = amount(details.due);
  const paid = amount(details.paid);
  const difference = amount(details.difference);
  return due !== null && paid !== null && difference !== null ? { due, paid, difference } : null;
}

/** Where a fact that holds a row back is fixed, when there is a page for it: the financial data of the owner (the mandate, the profile), the activation (the shares), the channel commissions. */
export interface FixTarget {
  kind: 'profile' | 'onboarding' | 'channelRules';
  to: string;
}

/** The page that resolves what stopped a row: the first of its codes (the reason, then the issues behind it) that has one. A reason with no page of its own is resolved from the row of the owner. */
export function fixTargetOf(row: Pick<OwnerBulkOwnerResult, 'ownerId' | 'code' | 'issues'>, period: Period): FixTarget | null {
  const codes = [...(row.code ? [row.code] : []), ...(row.issues ?? [])];
  for (const code of codes) {
    const action = actionForIssue({ code, ownerId: row.ownerId, propertyId: null, sourceId: null, blocking: true });
    if (action.kind === 'profile') return { kind: 'profile', to: ownerFinancialPath(row.ownerId, period) };
    if (action.kind === 'onboarding') return { kind: 'onboarding', to: OWNER_ONBOARDING_PATH };
    if (action.kind === 'channelRules') return { kind: 'channelRules', to: CHANNEL_COMMISSIONS_PATH };
  }
  return null;
}
