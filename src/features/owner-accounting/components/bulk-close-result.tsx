import { useId, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Alert, type AlertVariant } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { OwnerBulkOwnerResult, OwnerBulkRun } from '@/types';
import { codeWords, figuresOf, fixTargetOf, headlineOf, rowKindOf, tallyOf, verdictOf, type BulkVerdict, type RowKind } from '../bulk-close-model';
import type { Period } from '../owner-accounting-model';
import { useOwnerFormat } from '../use-owner-format';
import { Disclosure } from './disclosure';

const TONES: Record<Exclude<BulkVerdict, 'running'>, AlertVariant> = {
  allDone: 'success',
  doneWithFlags: 'warning',
  incomplete: 'warning',
  empty: 'info',
  someNotDone: 'danger',
  runFailed: 'danger',
};

const BADGES: Record<RowKind, 'destructive' | 'warning' | 'success' | 'outline'> = {
  failed: 'destructive',
  flagged: 'warning',
  done: 'success',
  unchanged: 'outline',
};

interface BulkCloseResultProps {
  /** A run that is over (`isRunOver`): what it comes to, and every owner that was not done or carries anomalies, by name and with the reason. */
  run: OwnerBulkRun;
  /** The month of the run: the pages that resolve a reason open knowing it. */
  period: Period;
  nameOf: (ownerId: string) => string;
}

/**
 * The result of a bulk step, owner by owner (E13/F02/US03/T01, AC-NF110-1). The line on top says what the run comes to from its ROWS (`verdictOf`): «fatto per tutti» only when the run is over,
 * every owner has a row and not one failed or has anomalies. Every owner that was not done is listed, all of them, with the reason in words, the facts of a close that does not reconcile and
 * the page that resolves it; so is every owner whose statement was made with anomalies. The owners that are done, or were already where the step leads, wait under one line: nothing to do there.
 */
export function BulkCloseResult({ run, period, nameOf }: BulkCloseResultProps) {
  const { t, i18n } = useTranslation();
  const verdict = verdictOf(run);
  const titleId = useId();
  if (verdict === 'running') return null;

  const tally = tallyOf(run);
  const rows = [...run.results].sort((a, b) => nameOf(a.ownerId).localeCompare(nameOf(b.ownerId)));
  const ofKind = (...kinds: RowKind[]) => rows.filter((row) => kinds.includes(rowKindOf(row)));
  const failed = ofKind('failed');
  const flagged = ofKind('flagged');
  const others = ofKind('done', 'unchanged');
  const exists = (key: string) => i18n.exists(key);

  const counts: Array<[RowKind, number]> = [
    ['failed', tally.failed],
    ['flagged', tally.flagged],
    ['done', tally.done],
    ['unchanged', tally.unchanged],
  ];

  return (
    <div className="grid gap-4" data-testid="bulk-result" data-verdict={verdict}>
      <Alert variant={TONES[verdict]} data-testid="bulk-headline" aria-labelledby={titleId}>
        <p id={titleId} className="font-medium">
          {headlineOf(run, t)}
        </p>
        {verdict === 'runFailed' && run.errorCode ? <p className="mt-1">{codeWords(run.errorCode, t, exists)}</p> : null}
      </Alert>

      {counts.some(([, count]) => count > 0) ? (
        <p className="flex flex-wrap items-center gap-2 text-sm" data-testid="bulk-tally">
          {counts
            .filter(([, count]) => count > 0)
            .map(([kind, count]) => (
              <Badge key={kind} variant={BADGES[kind]} data-testid={`bulk-tally-${kind}`}>
                {t(`ownerAccounting.bulk.result.tally.${kind}`, { count })}
              </Badge>
            ))}
        </p>
      ) : null}

      {failed.length > 0 ? (
        <ResultGroup title={t('ownerAccounting.bulk.result.failedTitle')} count={failed.length} testId="bulk-failed">
          {failed.map((row) => (
            <ResultRow key={row.ownerId} row={row} name={nameOf(row.ownerId)} period={period} />
          ))}
        </ResultGroup>
      ) : null}

      {flagged.length > 0 ? (
        <ResultGroup title={t('ownerAccounting.bulk.result.flaggedTitle')} count={flagged.length} testId="bulk-flagged">
          {flagged.map((row) => (
            <ResultRow key={row.ownerId} row={row} name={nameOf(row.ownerId)} period={period} />
          ))}
        </ResultGroup>
      ) : null}

      {others.length > 0 ? (
        <Disclosure title={t('ownerAccounting.bulk.result.others')} count={others.length} data-testid="bulk-others">
          <ul role="list" className="divide-y divide-border">
            {others.map((row) => (
              <ResultRow key={row.ownerId} row={row} name={nameOf(row.ownerId)} period={period} />
            ))}
          </ul>
        </Disclosure>
      ) : null}
    </div>
  );
}

interface ResultGroupProps {
  title: string;
  count: number;
  testId: string;
  children: ReactNode;
}

/** A list of owners that need a look: a heading with how many, and one row each, none left out. */
function ResultGroup({ title, count, testId, children }: ResultGroupProps) {
  const titleId = useId();
  return (
    <section aria-labelledby={titleId} className="min-w-0 space-y-1" data-testid={testId}>
      <h3 id={titleId} className="text-base font-semibold">
        {title} <span className="text-sm font-semibold tabular-nums text-foreground/70">{count}</span>
      </h3>
      <ul role="list" className="divide-y divide-border">
        {children}
      </ul>
    </section>
  );
}

interface ResultRowProps {
  row: OwnerBulkOwnerResult;
  name: string;
  period: Period;
}

/**
 * One owner of the run: the name and what happened, the reason in words (the code of the row, never a blank), the blocking issues behind it, the figures of a close that does not reconcile
 * (the amounts come with no currency: they are shown with no symbol and a line that says so) and the page that resolves it, when there is one.
 */
function ResultRow({ row, name, period }: ResultRowProps) {
  const { t, i18n } = useTranslation();
  const { amount } = useOwnerFormat();
  const kind = rowKindOf(row);
  const exists = (key: string) => i18n.exists(key);
  const reason = row.code ? codeWords(row.code, t, exists) : kind === 'failed' ? t('ownerAccounting.bulk.result.noReason') : null;
  const issues = (row.issues ?? []).filter((code) => code !== row.code);
  const figures = figuresOf(row);
  const target = kind === 'failed' || kind === 'flagged' ? fixTargetOf(row, period) : null;

  return (
    <li className="space-y-1 py-3" data-testid="bulk-result-row" data-owner={row.ownerId} data-kind={kind}>
      <p className="flex flex-wrap items-center gap-2 break-words font-medium">
        <span className="min-w-0 break-words">{name}</span>
        <Badge variant={BADGES[kind]}>{t(`ownerAccounting.bulk.result.status.${kind}`)}</Badge>
      </p>
      {reason ? (
        <p className="break-words text-sm" data-testid="bulk-result-reason">
          {reason}
        </p>
      ) : null}
      {issues.length > 0 ? (
        <ul role="list" className="list-disc space-y-0.5 pl-5 text-sm text-foreground/70" data-testid="bulk-result-issues">
          {issues.map((code) => (
            <li key={code} className="break-words">
              {codeWords(code, t, exists)}
            </li>
          ))}
        </ul>
      ) : null}
      {figures ? (
        <div className="space-y-0.5">
          <p className="text-sm tabular-nums" data-testid="bulk-result-figures">
            {t('ownerAccounting.bulk.result.figures', { due: amount(figures.due), paid: amount(figures.paid), difference: amount(figures.difference) })}
          </p>
          <p className="text-xs text-foreground/70">{t('ownerAccounting.bulk.result.figuresNoCurrency')}</p>
        </div>
      ) : null}
      {target ? (
        <Button asChild size="sm" variant="outline">
          <Link to={target.to} data-testid="bulk-result-fix">
            {t(`ownerAccounting.anomalies.actions.${target.kind}`)}
          </Link>
        </Button>
      ) : null}
    </li>
  );
}
