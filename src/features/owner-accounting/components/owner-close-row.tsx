import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useOwnerPayouts, useOwnerVersions } from '@/queries/use-owner-accounting';
import type { OwnerPeriodReadiness } from '@/types';
import {
  actionsOf,
  anomaliesOf,
  blockingAnomalies,
  isSettled,
  ownerFinancialPath,
  statementPath,
  type ActionContext,
  type Period,
} from '../owner-accounting-model';
import { useOwnerActions } from '../use-owner-actions';
import { useOwnerFormat } from '../use-owner-format';
import { OwnerActionButtons } from './owner-action-buttons';
import { OwnerActionDialogs } from './owner-action-dialogs';

interface OwnerCloseRowProps {
  period: Period;
  owner: OwnerPeriodReadiness;
  name: string;
  /** The month is over: only then can it be closed. */
  monthOver: boolean;
}

/**
 * One owner of the month (E06/F05/US02/T04): the name, where the statement stands, the balance it closes on, what is wrong, and the next step as
 * one button (the others in «⋯»). The versions of the owner are read here, for the owners that have one, and the payouts for the ones whose statement is approved or published
 * (a statement already paid is not asked to be paid again: its next step is the close): nothing is posted, regenerated or closed by reading them.
 */
export function OwnerCloseRow({ period, owner, name, monthOver }: OwnerCloseRowProps) {
  const { t } = useTranslation();
  const { money } = useOwnerFormat();
  const hasVersion = owner.latestVersion !== null;
  const versions = useOwnerVersions(period.year, period.month, owner.ownerId, hasVersion);
  // The newest version that is not superseded: a new version supersedes the one before, so it is the first of the list.
  const latest = versions.data?.find((version) => version.status !== 'Superseded') ?? null;
  const versionIds = (versions.data ?? []).map((version) => version.id);
  // The payments matter from the approval on, until the month is closed.
  const paid = owner.status !== 'Closed' && (latest?.status === 'Approved' || latest?.status === 'Published');
  const payouts = useOwnerPayouts(owner.ownerId, paid);
  const settled = paid && latest !== null && payouts.isSuccess && isSettled(latest, payouts.data, versionIds);

  const ctx: ActionContext = { period, ownerId: owner.ownerId, ownerName: name, version: latest, versionIds };
  const controller = useOwnerActions(ctx);
  const actions = actionsOf({ status: owner.status, version: latest, isDirty: owner.isDirty, issues: owner.issues, monthOver, settled });
  // Until the versions and the payments are read (or when the versions could not be), no action is offered: what is not known is not asked.
  const waiting = (hasVersion && versions.isPending) || (paid && payouts.isPending);
  const failed = hasVersion && versions.isError;
  const paymentsFailed = paid && payouts.isError;
  const anomalies = anomaliesOf(owner.issues);
  const blocking = blockingAnomalies(owner.issues).length;
  const testId = `row-${owner.ownerId}`;

  return (
    <li id={`owner-${owner.ownerId}`} className="flex scroll-mt-24 flex-col gap-3 py-4 sm:flex-row sm:items-start sm:justify-between" data-testid="owner-row" data-owner={owner.ownerId} data-status={latest?.status ?? 'none'}>
      <div className="min-w-0 space-y-1">
        <h4 className="break-words text-base font-semibold">
          {latest ? (
            <Link to={statementPath(latest.id)} className="underline-offset-4 hover:underline" data-testid={`${testId}-open`}>
              {name}
            </Link>
          ) : (
            name
          )}
        </h4>
        <p className="break-words text-sm text-foreground/70" data-testid={`${testId}-state`}>
          {waiting
            ? t('ownerAccounting.row.loading')
            : latest
              ? t('ownerAccounting.row.state', {
                  version: latest.version,
                  status: t(`ownerAccounting.version.status.${latest.status}`),
                  balance: money(latest.closingBalance, latest.currency),
                })
              : t('ownerAccounting.row.noStatement')}
        </p>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {owner.status === 'Closed' ? <Badge variant="success">{t('ownerAccounting.row.closed')}</Badge> : null}
          {actions.stale ? <Badge variant="warning">{t('ownerAccounting.row.stale')}</Badge> : null}
          {blocking > 0 ? <Badge variant="destructive">{t('ownerAccounting.row.blocking', { count: blocking })}</Badge> : anomalies.length > 0 ? <Badge variant="outline">{t('ownerAccounting.row.warnings', { count: anomalies.length })}</Badge> : null}
          <Button asChild variant="link" size="sm" className="h-auto p-0 text-xs">
            <Link to={ownerFinancialPath(owner.ownerId, period)}>{t('ownerAccounting.row.profile')}</Link>
          </Button>
        </div>
        {failed ? (
          <p role="alert" className="text-sm text-destructive">
            {t('ownerAccounting.row.versionsError')}{' '}
            <Button type="button" variant="link" size="sm" className="h-auto p-0" onClick={() => void versions.refetch()}>
              {t('shared.errorState.retry')}
            </Button>
          </p>
        ) : null}
        {paymentsFailed ? (
          <p role="alert" className="text-sm text-destructive" data-testid={`${testId}-payments-error`}>
            {t('ownerAccounting.row.paymentsError')}{' '}
            <Button type="button" variant="link" size="sm" className="h-auto p-0" onClick={() => void payouts.refetch()}>
              {t('shared.errorState.retry')}
            </Button>
          </p>
        ) : null}
      </div>
      {waiting || failed ? null : <OwnerActionButtons actions={actions} busy={controller.generating} onAsk={controller.ask} testId={testId} />}
      <OwnerActionDialogs ctx={ctx} asked={controller.asked} onDismiss={controller.dismiss} generate={controller.generate} generating={controller.generating} />
    </li>
  );
}
