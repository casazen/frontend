import { useMemo, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/page-header';
import { PlainSection } from '@/components/shared/calm';
import { Button } from '@/components/ui/button';
import { SkeletonCard } from '@/components/ui/skeleton';
import { useWorkspace } from '@/hooks/use-workspace';
import { isOrgBillingAdmin } from '@/lib/org-billing-admin';
import { endOfMonth, todayInRome } from '@/lib/stay-dates';
import { ownerAccountingKeys, useCloseReadiness, useOwnerNames, usePostPeriod } from '@/queries/use-owner-accounting';
import type { OwnerStatementVersion } from '@/types';
import { CloseReadinessPanel } from './components/close-readiness-panel';
import { CorrectionDialog } from './components/correction-dialog';
import { FxRateDialog } from './components/fx-rate-dialog';
import { FinanceAdminRequired, OwnerAccountingError } from './components/owner-accounting-error';
import { OwnerCloseRow } from './components/owner-close-row';
import { TaxFilingPanel } from './components/tax-filing-panel';
import {
  OWNER_GROUPS,
  defaultPeriod,
  isPeriodOver,
  messageOf,
  ownersOf,
  parsePeriod,
  periodParam,
  shiftPeriod,
  shortId,
  summarize,
  type OwnerGroup,
  type Period,
} from './owner-accounting-model';
import { useOwnerFormat } from './use-owner-format';

/**
 * «Chiusura mensile» of the Amministrazione (E06/F05/US02/T04, NF-110): the month of the agency's owners in four groups, what is still to prepare,
 * to check, approved and published, how ready the month is and what is wrong, and for each owner the next step of the controlled close: check,
 * approve, publish, pay, close. Opening the page only reads. Every change is the person's click, with a confirmation proportionate to the risk,
 * and a statement that was published is never edited: the only change is a new version.
 */
export function MonthEndClosePage() {
  const { t } = useTranslation();
  const { contexts } = useWorkspace();

  if (!isOrgBillingAdmin(contexts)) {
    return (
      <div className="space-y-6" data-testid="month-end-close-page">
        <PageHeader title={t('ownerAccounting.title')} description={t('ownerAccounting.description')} crumbs="auto" />
        <FinanceAdminRequired />
      </div>
    );
  }
  return <MonthEndCloseBody />;
}

type PageDialog = { kind: 'fx' } | { kind: 'correction'; ownerId: string } | null;

function MonthEndCloseBody() {
  const { t } = useTranslation();
  const { month } = useOwnerFormat();
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const today = todayInRome();
  const suggested = defaultPeriod(today);
  const period = parsePeriod(params.get('period'), suggested);
  const readinessQuery = useCloseReadiness(period.year, period.month);
  const ownersQuery = useOwnerNames();
  const post = usePostPeriod();
  const [dialog, setDialog] = useState<PageDialog>(null);

  const names = useMemo(() => new Map((ownersQuery.data ?? []).map((owner) => [owner.id, `${owner.firstName} ${owner.lastName}`.trim()] as const)), [ownersQuery.data]);
  const readiness = readinessQuery.data;
  const summary = useMemo(() => (readiness ? summarize(readiness) : null), [readiness]);
  const monthOver = isPeriodOver(period, today);

  const goTo = (next: Period) => setParams({ period: periodParam(next) });
  const nameOf = (ownerId: string) => names.get(ownerId) ?? t('ownerAccounting.owner.unnamed', { id: shortId(ownerId) });

  const onPost = async () => {
    try {
      const result = await post.mutateAsync(period);
      toast.success(t('ownerAccounting.post.done', { posted: result.posted, reversed: result.reversed, unchanged: result.unchanged }));
    } catch (error) {
      toast.error(messageOf(error, t));
    }
  };

  /** The currency of an owner's statements, when the row of the owner has read its versions: the correction is made in it. */
  const currencyOf = (ownerId: string) => queryClient.getQueryData<OwnerStatementVersion[]>(ownerAccountingKeys.versions(period.year, period.month, ownerId))?.[0]?.currency;
  const lastDay = endOfMonth(`${periodParam(period)}-01`);

  const switcher = (
    <nav aria-label={t('ownerAccounting.period.label')} className="flex items-center gap-2" data-testid="period-switcher">
      <Button type="button" variant="outline" size="icon" aria-label={t('ownerAccounting.period.previous')} onClick={() => goTo(shiftPeriod(period, -1))} data-testid="period-previous">
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
      </Button>
      <span className="min-w-32 text-center text-sm font-medium capitalize" aria-live="polite" data-testid="period-current">
        {month(period.year, period.month)}
      </span>
      <Button type="button" variant="outline" size="icon" aria-label={t('ownerAccounting.period.next')} onClick={() => goTo(shiftPeriod(period, 1))} data-testid="period-next">
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
      </Button>
    </nav>
  );

  let content: ReactNode = null;
  if (readinessQuery.isPending) {
    content = (
      <div data-testid="month-loading">
        <SkeletonCard lines={4} label={t('ownerAccounting.loading')} />
      </div>
    );
  } else if (readinessQuery.isError || !readiness || !summary) {
    content = <OwnerAccountingError error={readinessQuery.error} title={t('ownerAccounting.loadError')} onRetry={() => void readinessQuery.refetch()} />;
  } else {
    content = (
      <div className="space-y-8">
        <CloseReadinessPanel
          readiness={readiness}
          summary={summary}
          period={period}
          names={names}
          onPost={() => void onPost()}
          posting={post.isPending}
          onFix={(issue, action) => setDialog(action.kind === 'fx' ? { kind: 'fx' } : issue.ownerId ? { kind: 'correction', ownerId: issue.ownerId } : null)}
        />

        {summary.owners > 0 ? (
          <PlainSection title={t('ownerAccounting.rows.title')} count={summary.owners} data-testid="month-owners">
            <div className="space-y-6">
              {OWNER_GROUPS.map((group) => (
                <OwnerGroupSection key={group} group={group} period={period} monthOver={monthOver} owners={ownersOf(readiness, group)} nameOf={nameOf} />
              ))}
            </div>
          </PlainSection>
        ) : null}

        <TaxFilingPanel period={period} />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="month-end-close-page">
      <PageHeader title={t('ownerAccounting.title')} description={t('ownerAccounting.description')} crumbs="auto" action={switcher} />
      {period.year === suggested.year && period.month === suggested.month ? null : (
        <p className="text-sm text-foreground/70">
          <Button type="button" variant="link" className="h-auto p-0" onClick={() => goTo(suggested)} data-testid="period-suggested">
            {t('ownerAccounting.period.backToSuggested', { period: month(suggested.year, suggested.month) })}
          </Button>
        </p>
      )}
      {content}
      {dialog?.kind === 'fx' ? <FxRateDialog open onOpenChange={(open) => !open && setDialog(null)} defaultDate={lastDay > today ? today : lastDay} /> : null}
      {dialog?.kind === 'correction' ? (
        <CorrectionDialog open onOpenChange={(open) => !open && setDialog(null)} ownerId={dialog.ownerId} ownerName={nameOf(dialog.ownerId)} currency={currencyOf(dialog.ownerId)} />
      ) : null}
    </div>
  );
}

interface OwnerGroupSectionProps {
  group: OwnerGroup;
  period: Period;
  monthOver: boolean;
  owners: ReturnType<typeof ownersOf>;
  nameOf: (ownerId: string) => string;
}

/** One of the four groups, a heading under the section of the owners: the owners in it by name. A group with nobody in it is not shown (a calm page shows what there is to do). */
function OwnerGroupSection({ group, period, monthOver, owners, nameOf }: OwnerGroupSectionProps) {
  const { t } = useTranslation();
  if (owners.length === 0) return null;
  const sorted = [...owners].sort((a, b) => nameOf(a.ownerId).localeCompare(nameOf(b.ownerId)));

  return (
    <div className="min-w-0 space-y-1" data-testid={`group-${group}`}>
      <h3 className="text-base font-semibold">
        {t(`ownerAccounting.groups.${group}.title`)} <span className="text-sm font-semibold tabular-nums text-foreground/70">{owners.length}</span>
      </h3>
      <p className="break-words text-sm text-foreground/70">{t(`ownerAccounting.groups.${group}.hint`)}</p>
      <ul role="list" className="divide-y divide-border">
        {sorted.map((owner) => (
          <OwnerCloseRow key={owner.ownerId} period={period} owner={owner} name={nameOf(owner.ownerId)} monthOver={monthOver} />
        ))}
      </ul>
    </div>
  );
}
