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

export function isBulkAction(value: string): value is OwnerBulkAction {
  return (OWNER_BULK_ACTIONS as readonly string[]).includes(value);
}

export function suggestedBulkAction(readiness: OwnerCloseReadiness, summary: CloseSummary, monthOver: boolean): OwnerBulkAction {
  const issues = [...readiness.issues, ...readiness.owners.flatMap((owner) => owner.issues)];
  if (issues.some((issue) => actionForIssue(issue).kind === 'post')) return 'Post';
  if (summary.groups.toPrepare > 0) return 'Generate';
  if (summary.groups.toVerify > 0) return 'Approve';
  if (summary.groups.approved > 0) return 'Publish';
  if (monthOver && summary.closed < summary.owners) return 'Close';
  return 'Post';
}

export function isRunOver(run: Pick<OwnerBulkRun, 'status'>): boolean {
  return run.status !== 'Queued' && run.status !== 'Running';
}

const FLAGGED_CODE = 'owner_statement_flagged';

export type RowKind = 'failed' | 'flagged' | 'done' | 'unchanged';

export function rowKindOf(row: Pick<OwnerBulkOwnerResult, 'ok' | 'code' | 'unchanged'>): RowKind {
  if (!row.ok) return 'failed';
  if (row.code === FLAGGED_CODE) return 'flagged';
  return row.unchanged ? 'unchanged' : 'done';
}

export interface BulkTally {
  total: number;
  answered: number;
  done: number;
  unchanged: number;
  flagged: number;
  failed: number;
}

export function tallyOf(run: Pick<OwnerBulkRun, 'total' | 'results'>): BulkTally {
  const tally: BulkTally = { total: run.total, answered: run.results.length, done: 0, unchanged: 0, flagged: 0, failed: 0 };
  for (const row of run.results) tally[rowKindOf(row)] += 1;
  return tally;
}

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

export function unansweredOf(run: Pick<OwnerBulkRun, 'total' | 'results'>): number {
  return Math.max(0, run.total - run.results.length);
}

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

export function progressPercent(run: Pick<OwnerBulkRun, 'total' | 'results'>): number {
  return run.total <= 0 ? 0 : Math.min(100, Math.round((run.results.length / run.total) * 100));
}

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

export function figuresOf(row: Pick<OwnerBulkOwnerResult, 'details'>): BulkFigures | null {
  const details = row.details;
  if (!details) return null;
  const amount = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) ? value : null);
  const due = amount(details.due);
  const paid = amount(details.paid);
  const difference = amount(details.difference);
  return due !== null && paid !== null && difference !== null ? { due, paid, difference } : null;
}

export interface FixTarget {
  kind: 'profile' | 'onboarding' | 'channelRules';
  to: string;
}

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
