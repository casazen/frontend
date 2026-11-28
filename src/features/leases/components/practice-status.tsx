import { useTranslation } from 'react-i18next';
import { CfStatusBadge } from '@/components/cf-status-badge';
import { formatDateTime } from '@/lib/utils';
import type { CfPracticeResponse, CfPracticeStatus } from '@/types/concordatofacile.types';
import { useCfPractices } from '../lib/cf-practices';

const WAITS_FOR_THE_PERSON: readonly CfPracticeStatus[] = ['AwaitingUser', 'Suspended'];

function changedOn(value: string): string | null {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : formatDateTime(date);
}

export function PracticeStatusLine({ practice }: { practice: CfPracticeResponse }) {
  const { t } = useTranslation();
  const changed = changedOn(practice.statusChangedAt);
  return (
    <>
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm" data-testid="lease-partner-status">
        <span className="text-foreground/70">{t('guidedContract.statusLabel')}</span>
        <CfStatusBadge status={practice.status} />
        {changed ? <span className="text-foreground/70">{t('guidedContract.lastChange', { date: changed })}</span> : null}
      </p>
      <p className="text-xs text-foreground/70" data-testid="lease-partner-practice">
        {t('leaseRound.practice.number', { id: practice.practiceId })}
      </p>
      {WAITS_FOR_THE_PERSON.includes(practice.status) ? (
        <p className="text-sm font-medium" data-testid="lease-partner-hint">
          {t(`guidedContract.hint.${practice.status}`)}
        </p>
      ) : null}
    </>
  );
}

export function PracticeLine({ leaseId }: { leaseId: string }) {
  const { running } = useCfPractices(leaseId);
  return running ? <PracticeStatusLine practice={running} /> : null;
}
