import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FocusBlock, PlainSection } from '@/components/shared/calm';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import type { OwnerCloseReadiness, OwnerReadinessIssue } from '@/types';
import {
  OWNER_ONBOARDING_PATH,
  actionForIssue,
  camelCode,
  groupAnomalies,
  isKnownIssue,
  ownerFinancialPath,
  shortId,
  type AnomalyGroup,
  type CloseSummary,
  type IssueAction,
  type Period,
} from '../owner-accounting-model';
import { useOwnerFormat } from '../use-owner-format';

/** The anomalies shown before «Mostra tutte»: a month with many is not a wall of them. */
const VISIBLE_ANOMALIES = 5;

interface CloseReadinessPanelProps {
  readiness: OwnerCloseReadiness;
  summary: CloseSummary;
  period: Period;
  /** The names of the owners by id (the registry). */
  names: ReadonlyMap<string, string>;
  /** «Controlla il mese»: posts the ledger lines of the month from their sources, then reads the readiness again. */
  onPost: () => void;
  posting: boolean;
  /** Opens the dialog that resolves an issue (an exchange rate, a manual correction): the page owns the dialogs. */
  onFix: (issue: OwnerReadinessIssue, action: Extract<IssueAction, { kind: 'fx' | 'correction' }>) => void;
}

/**
 * The readiness of the month (E06/F05/US02/T04, AC-NF110-1): how many statements are ready to go on, as a number and a bar, and every anomaly in
 * words with what resolves it. It is the one highlighted block of the page. The anomalies come from the server's readiness, which only reads:
 * «Controlla il mese» is what posts, and it is the person's click, never the opening of the page.
 */
export function CloseReadinessPanel({ readiness, summary, period, names, onPost, posting, onFix }: CloseReadinessPanelProps) {
  const { t } = useTranslation();
  const { month } = useOwnerFormat();
  const [showAll, setShowAll] = useState(false);
  const groups = groupAnomalies(readiness);
  const shown = showAll ? groups : groups.slice(0, VISIBLE_ANOMALIES);
  const periodName = month(period.year, period.month);

  const everythingClosed = summary.owners > 0 && summary.closed === summary.owners;
  const tone = summary.blocking > 0 ? 'warning' : everythingClosed ? 'success' : 'neutral';
  const title =
    summary.owners === 0 && summary.blocking === 0
      ? t('ownerAccounting.focus.empty.title', { period: periodName })
      : summary.blocking > 0
        ? t('ownerAccounting.focus.blocked.title', { count: summary.blocking })
        : everythingClosed
          ? t('ownerAccounting.focus.closed.title', { period: periodName })
          : t('ownerAccounting.focus.ready.title');
  const body =
    summary.owners === 0
      ? t('ownerAccounting.focus.empty.body')
      : everythingClosed
        ? t('ownerAccounting.focus.closed.body')
        : t('ownerAccounting.focus.body', { ready: summary.ready, owners: summary.owners, percent: summary.percent });

  return (
    <div className="space-y-4" data-testid="close-readiness">
      <FocusBlock
        tone={tone}
        kicker={t('ownerAccounting.focus.kicker', { period: periodName })}
        title={title}
        body={body}
        who={t('ownerAccounting.focus.who')}
        then={summary.blocking > 0 ? t('ownerAccounting.focus.then') : undefined}
        primary={{ label: t('ownerAccounting.focus.check'), onClick: onPost, loading: posting, testId: 'close-check' }}
        data-testid="close-focus"
      />

      {summary.owners > 0 ? (
        <div className="space-y-1">
          <Progress
            value={summary.percent}
            label={t('ownerAccounting.readiness.label')}
            valueText={t('ownerAccounting.readiness.valueText', { ready: summary.ready, owners: summary.owners })}
            tone={summary.percent === 100 ? 'success' : 'default'}
            data-testid="close-readiness-bar"
          />
          <p className="text-sm text-foreground/70" data-testid="close-readiness-percent">
            {t('ownerAccounting.readiness.percent', { percent: summary.percent, ready: summary.ready, owners: summary.owners })}
          </p>
        </div>
      ) : null}

      {groups.length > 0 ? (
        <PlainSection title={t('ownerAccounting.anomalies.title')} count={groups.length} data-testid="close-anomalies">
          <ul role="list" className="divide-y divide-border">
            {shown.map((group) => (
              <AnomalyRow key={group.key} group={group} names={names} period={period} onPost={onPost} onFix={onFix} posting={posting} />
            ))}
          </ul>
          {groups.length > VISIBLE_ANOMALIES ? (
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowAll((current) => !current)} data-testid="close-anomalies-toggle">
              {showAll ? t('ownerAccounting.anomalies.showLess') : t('ownerAccounting.anomalies.showAll', { count: groups.length })}
            </Button>
          ) : null}
        </PlainSection>
      ) : null}
    </div>
  );
}

interface AnomalyRowProps {
  group: AnomalyGroup;
  names: ReadonlyMap<string, string>;
  period: Period;
  onPost: () => void;
  posting: boolean;
  onFix: CloseReadinessPanelProps['onFix'];
}

function AnomalyRow({ group, names, period, onPost, posting, onFix }: AnomalyRowProps) {
  const { t } = useTranslation();
  const { issue } = group;
  const action = actionForIssue(issue);
  const known = isKnownIssue(group.code);
  const key = camelCode(group.code);
  const owner = group.ownerId ? (names.get(group.ownerId) ?? t('ownerAccounting.owner.unnamed', { id: shortId(group.ownerId) })) : t('ownerAccounting.anomalies.wholeMonth');

  return (
    <li className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:justify-between" data-testid="anomaly" data-code={group.code} data-blocking={group.blocking}>
      <div className="min-w-0 space-y-0.5">
        <p className="break-words text-sm text-foreground/70">{owner}</p>
        <p className="break-words font-medium">
          {known ? t(`ownerAccounting.issue.${key}.title`) : t('ownerAccounting.issue.unknown.title', { code: group.code })}
          {group.count > 1 ? <span className="ml-2 text-sm font-normal tabular-nums text-foreground/70" data-testid="anomaly-count">{t('ownerAccounting.anomalies.times', { count: group.count })}</span> : null}
          {!group.blocking ? <span className="ml-2 text-sm font-normal text-foreground/70">{t('ownerAccounting.anomalies.notBlocking')}</span> : null}
        </p>
        <p className="break-words text-sm text-foreground/70">{known ? t(`ownerAccounting.issue.${key}.how`) : t('ownerAccounting.issue.unknown.how')}</p>
      </div>
      <div className="shrink-0">{renderAction(action, group, { t, period, onPost, posting, onFix })}</div>
    </li>
  );
}

interface ActionEnv {
  t: ReturnType<typeof useTranslation>['t'];
  /** The month being closed: the page of an owner's data opens knowing it. */
  period: Period;
  onPost: () => void;
  posting: boolean;
  onFix: CloseReadinessPanelProps['onFix'];
}

/** The button or the link that resolves an anomaly: it opens the dialog or the page where the fact is fixed. Never a button that fixes it behind the person's back. */
function renderAction(action: IssueAction, group: AnomalyGroup, { t, period, onPost, posting, onFix }: ActionEnv) {
  switch (action.kind) {
    case 'post':
      return (
        <Button type="button" size="sm" variant="outline" loading={posting} onClick={onPost}>
          {t('ownerAccounting.anomalies.actions.post')}
        </Button>
      );
    case 'fx':
    case 'correction':
      return (
        <Button type="button" size="sm" variant="outline" onClick={() => onFix(group.issue, action)}>
          {t(`ownerAccounting.anomalies.actions.${action.kind}`)}
        </Button>
      );
    case 'profile':
      return group.ownerId ? (
        <Button asChild size="sm" variant="outline">
          <Link to={ownerFinancialPath(group.ownerId, period)}>{t('ownerAccounting.anomalies.actions.profile')}</Link>
        </Button>
      ) : null;
    case 'onboarding':
      return (
        <Button asChild size="sm" variant="outline">
          <Link to={OWNER_ONBOARDING_PATH}>{t('ownerAccounting.anomalies.actions.onboarding')}</Link>
        </Button>
      );
    case 'payment':
      return (
        <Button asChild size="sm" variant="outline">
          <Link to={`/app/short-rent/payments/${action.paymentId}`}>{t('ownerAccounting.anomalies.actions.payment')}</Link>
        </Button>
      );
    case 'regenerate':
    case 'prepare':
    case 'approve':
      // The step is the button of the owner's row below: this line only points at it.
      return group.ownerId ? (
        <Button asChild size="sm" variant="outline">
          <a href={`#owner-${group.ownerId}`}>{t('ownerAccounting.anomalies.actions.row')}</a>
        </Button>
      ) : null;
    default:
      return null;
  }
}
