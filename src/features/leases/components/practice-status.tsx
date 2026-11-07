import { useTranslation } from 'react-i18next';
import { CfStatusBadge } from '@/components/cf-status-badge';
import { formatDateTime } from '@/lib/utils';
import type { CfPracticeResponse, CfPracticeStatus } from '@/types/concordatofacile.types';
import { useCfPractices } from '../lib/cf-practices';

/**
 * The statuses in which the practice waits for the person and not for the service: a request for data or documents was e-mailed to
 * them (`AwaitingUser`), or the practice stopped for want of an answer (`Suspended`). Nothing else in the sheet would send them to their mailbox.
 */
const WAITS_FOR_THE_PERSON: readonly CfPracticeStatus[] = ['AwaitingUser', 'Suspended'];

/** The date of a practice as the person reads it; nothing for a value that is not a date (the sheet never fails on the service's data). */
function changedOn(value: string): string | null {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : formatDateTime(date);
}

/**
 * The state of the practice in the sheet of the lease (CF-DONE): the state with the day it changed, the number of the practice (discreet,
 * for whoever has to find it) and, when the practice waits for the person, where to look. The one place the practice is told, whatever the
 * block it stands in: the card of the draft before the documents arrive, the card of the contract that was delivered after.
 */
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

/** The line of the practice of a lease that is under way, read from the server: nothing while it is not known, or when none is running. */
export function PracticeLine({ leaseId }: { leaseId: string }) {
  const { running } = useCfPractices(leaseId);
  return running ? <PracticeStatusLine practice={running} /> : null;
}
