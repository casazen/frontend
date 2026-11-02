import { UserRound } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { StatusBadge } from '@/components/shared/status/status-badge';
import { Progress } from '@/components/ui/progress';
import { todayInRome } from '@/lib/stay-dates';
import { cn } from '@/lib/utils';
import type { LeaseSummary } from '@/types';
import { leaseProgressText } from '../lib/lease-list-format';
import { describeLeaseStep } from '../lib/lease-next-step';

/** The state of the lease: its stage on the path when the server sends it, the status of the contract otherwise. */
export function LeaseStateBadge({ lease }: { lease: LeaseSummary }) {
  return lease.stage ? <StatusBadge kind="leaseStage" status={lease.stage} /> : <StatusBadge kind="lease" status={lease.status} />;
}

/** The bar and the words that say what it measures («3 di 8 passi», «Anno 4 di 8»). Nothing without a progress from the server. */
export function LeaseProgressCell({ lease }: { lease: LeaseSummary }) {
  const { t } = useTranslation();
  const progress = lease.progress;
  if (!progress) return <span aria-hidden="true">—</span>;

  const text = leaseProgressText(progress, t);
  return (
    <span className="block min-w-0 max-w-48 space-y-1">
      <Progress value={progress.percent} size="sm" tone={progress.kind === 'End' ? 'success' : 'default'} label={t('leaseList.columns.progress')} valueText={text} />
      <span className="block break-words text-sm text-foreground/70">{text}</span>
    </span>
  );
}

/** What the lease waits for, in a sentence, with whose turn it is (icon and words) and when; only what is late is red. */
export function LeaseNextStepCell({ lease }: { lease: LeaseSummary }) {
  const { t, i18n } = useTranslation();
  if (!lease.nextStep) return <span aria-hidden="true">—</span>;

  const view = describeLeaseStep(lease.id, lease.nextStep, { t, language: i18n.language, today: todayInRome() });
  return (
    <span className="block min-w-0">
      <span className="block break-words font-medium">{view.title}</span>
      <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-foreground/70">
        {view.who ? (
          <span className="inline-flex items-center gap-1">
            <UserRound className="size-3.5 shrink-0" aria-hidden="true" />
            {view.who}
          </span>
        ) : null}
        {view.when ? <span className={cn('break-words', view.tone === 'danger' && 'font-medium text-danger-foreground')}>{view.when}</span> : null}
      </span>
    </span>
  );
}
