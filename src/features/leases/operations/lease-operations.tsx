import { useContext } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PlainSection } from '@/components/shared/calm';
import { WorkspaceContext } from '@/contexts/workspace-context';
import { useLeaseOperations } from '@/queries/use-lease-operations';
import type { LeaseDetail, LeaseOperations as LeaseOperationsData } from '@/types';
import { GuideButton } from '../guide/guide-button';
import { longDay } from '../lifecycle/lifecycle-format';
import { DisdettaDialog } from './disdetta-dialog';
import { LEASE_OPERATION_PARAM, leaseOperationOf, type LeaseOperationId } from './operation-ids';
import { availableOperations, letterState } from './operations-model';
import { WithdrawalDialog } from './withdrawal-dialog';

interface OperationRowProps {
  title: string;
  summary: string;
  openLabel: string;
  onOpen: () => void;
  testId: string;
}

/** An operation in one row: what it is, where it stands in a sentence, and the button that opens its window (the same look as a tool of the guide). */
function OperationRow({ title, summary, openLabel, onOpen, testId }: OperationRowProps) {
  return (
    <li className="min-w-0 space-y-2 py-4" data-testid={testId}>
      <h3 className="break-words text-base font-semibold leading-snug">{title}</h3>
      <p className="break-words text-sm text-foreground/80" data-testid={`${testId}-summary`}>
        {summary}
      </p>
      <div>
        <GuideButton label={openLabel} onClick={onOpen} testId={`${testId}-open`} />
      </div>
    </li>
  );
}

interface RowProps {
  lease: LeaseDetail;
  operations: LeaseOperationsData;
  onOpen: () => void;
}

/** The notice of non-renewal: when it is on time, or that it was marked as sent, or that it is recorded in the contract. */
function DisdettaRow({ lease, operations, onOpen }: RowProps) {
  const { t, i18n } = useTranslation();
  const { disdetta } = operations;
  const sent = letterState(operations, 'Disdetta')?.sent;

  let summary: string;
  if (sent) {
    summary = t('leaseOperations.disdetta.summarySent', { date: longDay(sent.on, i18n.language), means: t(`leaseOperations.means.${sent.means}`) });
  } else if (lease.noticeOn) {
    summary = t('leaseOperations.disdetta.summaryRecorded', { date: longDay(disdetta.periodEnd, i18n.language) });
  } else {
    summary = t(disdetta.late ? 'leaseOperations.disdetta.summaryLate' : 'leaseOperations.disdetta.summary', {
      date: longDay(disdetta.lastDayToGiveNotice, i18n.language),
    });
  }

  return (
    <OperationRow
      testId="lease-operation-disdetta"
      title={t('leaseOperations.disdetta.title')}
      summary={summary}
      openLabel={t('leaseOperations.disdetta.open')}
      onOpen={onOpen}
    />
  );
}

/** The withdrawal of the tenant: to record, or recorded with the day the lease ends. */
function WithdrawalRow({ operations, onOpen }: Omit<RowProps, 'lease'>) {
  const { t, i18n } = useTranslation();
  const recorded = operations.withdrawal.recorded;

  return (
    <OperationRow
      testId="lease-operation-recesso"
      title={t('leaseOperations.withdrawal.title')}
      summary={
        recorded
          ? t('leaseOperations.withdrawal.summaryRecorded', { date: longDay(recorded.effectiveOn, i18n.language) })
          : t('leaseOperations.withdrawal.summary')
      }
      openLabel={t(recorded ? 'leaseOperations.withdrawal.openRecorded' : 'leaseOperations.withdrawal.open')}
      onOpen={onOpen}
    />
  );
}

interface LeaseOperationsProps {
  lease: LeaseDetail;
}

/**
 * «Operazioni» (LR-OPS-1): what the landlord can do now about the end of a lease in force, one row each, in the guide. The notice of
 * non-renewal («Disdetta all'inquilino») while a letter makes sense, and the withdrawal of the tenant («Recesso dell'inquilino») while it can
 * be recorded or once it was. Each row says where the operation stands in a sentence and opens a window (`?operazione=disdetta`,
 * `?operazione=recesso`: a link from the advice or the step of the sheet lands on it) with the two or three fields it needs and the draft of
 * the letter to download. What is computed (the last day a notice is on time, the day a withdrawal ends the lease) comes from the server.
 * Nothing is sent to the tenant. A person who may not write the leases, a lease with nothing to do and an answer that fails see no
 * section at all: the guide is the guide it was.
 */
export function LeaseOperations({ lease }: LeaseOperationsProps) {
  const { t } = useTranslation();
  const workspace = useContext(WorkspaceContext);
  // Without a workspace (a page rendered on its own) nothing is hidden: the server decides.
  const canManage = workspace ? workspace.hasPermission('long-rent', 'lease.create') : true;
  const operations = useLeaseOperations(lease.id, canManage);
  const [searchParams, setSearchParams] = useSearchParams();
  const data = operations.data;

  if (!data) return null;
  const available = availableOperations(data);
  if (!available.disdetta && !available.recesso) return null;

  const asked = leaseOperationOf(searchParams.get(LEASE_OPERATION_PARAM));
  const open = asked !== null && available[asked] ? asked : null;

  function go(operation: LeaseOperationId | null) {
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (operation === null) next.delete(LEASE_OPERATION_PARAM);
        else next.set(LEASE_OPERATION_PARAM, operation);
        return next;
      },
      { replace: true },
    );
  }

  return (
    <>
      <PlainSection title={t('leaseOperations.title')} data-testid="lease-operations">
        <ul role="list" className="divide-y divide-border border-y border-border">
          {available.disdetta ? <DisdettaRow lease={lease} operations={data} onOpen={() => go('disdetta')} /> : null}
          {available.recesso ? <WithdrawalRow operations={data} onOpen={() => go('recesso')} /> : null}
        </ul>
      </PlainSection>

      <DisdettaDialog open={open === 'disdetta'} lease={lease} operations={data} onClose={() => go(null)} />
      <WithdrawalDialog open={open === 'recesso'} lease={lease} operations={data} onClose={() => go(null)} />
    </>
  );
}
