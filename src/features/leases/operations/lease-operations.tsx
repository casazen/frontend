import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PlainSection } from '@/components/shared/calm';
import type { LeaseDetail, LeaseOperations as LeaseOperationsData } from '@/types';
import { GuideButton } from '../guide/guide-button';
import { leaseTermEnd, longDay } from '../lifecycle/lifecycle-format';
import { CedolareDialog } from './cedolare-dialog';
import { DisdettaDialog } from './disdetta-dialog';
import { IstatDialog } from './istat-dialog';
import { NeedConfirmationDialog } from './need-confirmation-dialog';
import { LEASE_OPERATION_PARAM, LEASE_OPERATIONS, leaseOperationOf, type LeaseOperationId } from './operation-ids';
import { availableOperations, letterState } from './operations-model';
import { RenewalDialog } from './renewal-dialog';
import { useSheetOperations } from './use-sheet-operations';
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

/**
 * The renewal: that it can be recorded now (the last stretch before the end of the period), or that it was and where the contract goes on to.
 * While a new renewal can be recorded the old record is history and the row offers the form.
 */
function RenewalRow({ lease, operations, onOpen }: RowProps) {
  const { t, i18n } = useTranslation();
  const { renewal } = operations;
  const recorded = renewal.available ? null : renewal.recorded;

  return (
    <OperationRow
      testId="lease-operation-rinnovo"
      title={t('leaseOperations.renewal.title')}
      summary={
        recorded
          ? t('leaseOperations.renewal.summaryRecorded', { date: longDay(recorded.to, i18n.language) })
          : t('leaseOperations.renewal.summary', { date: longDay(leaseTermEnd(lease), i18n.language) })
      }
      openLabel={t(recorded ? 'leaseOperations.renewal.openRecorded' : 'leaseOperations.renewal.open')}
      onOpen={onOpen}
    />
  );
}

/** The confirmation of the need of a transitory lease: by which day, or that the letter was marked as sent. */
function NeedConfirmationRow({ operations, onOpen }: Omit<RowProps, 'lease'>) {
  const { t, i18n } = useTranslation();
  const sent = letterState(operations, 'ConfermaEsigenza')?.sent;

  return (
    <OperationRow
      testId="lease-operation-conferma-esigenza"
      title={t('leaseOperations.needConfirmation.title')}
      summary={
        sent
          ? t('leaseOperations.needConfirmation.summarySent', { date: longDay(sent.on, i18n.language), means: t(`leaseOperations.means.${sent.means}`) })
          : t('leaseOperations.needConfirmation.summary', { date: longDay(operations.transitoryConfirmation.confirmBy, i18n.language) })
      }
      openLabel={t('leaseOperations.needConfirmation.open')}
      onOpen={onOpen}
    />
  );
}

/** The ISTAT update of the rent: that it can be calculated (if the contract allows it), or that the request was marked as sent. */
function IstatRow({ operations, onOpen }: Omit<RowProps, 'lease'>) {
  const { t, i18n } = useTranslation();
  const sent = letterState(operations, 'AggiornamentoIstat')?.sent;

  return (
    <OperationRow
      testId="lease-operation-istat"
      title={t('leaseOperations.istat.title')}
      summary={
        sent
          ? t('leaseOperations.istat.summarySent', { date: longDay(sent.on, i18n.language), means: t(`leaseOperations.means.${sent.means}`) })
          : t('leaseOperations.istat.summary')
      }
      openLabel={t('leaseOperations.istat.open')}
      onOpen={onOpen}
    />
  );
}

/** The communication of the cedolare secca to the tenant, with the renunciation of the updates of the rent: or that the letter was marked as sent. */
function CedolareRow({ operations, onOpen }: Omit<RowProps, 'lease'>) {
  const { t, i18n } = useTranslation();
  const sent = letterState(operations, 'OpzioneCedolare')?.sent;

  return (
    <OperationRow
      testId="lease-operation-cedolare"
      title={t('leaseOperations.cedolare.title')}
      summary={
        sent
          ? t('leaseOperations.cedolare.summarySent', { date: longDay(sent.on, i18n.language), means: t(`leaseOperations.means.${sent.means}`) })
          : t('leaseOperations.cedolare.summary')
      }
      openLabel={t('leaseOperations.cedolare.open')}
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
 * non-renewal («Disdetta all'inquilino») while a letter makes sense, the renewal («Rinnovo del contratto») in the last stretch of the period,
 * the confirmation of the need of a transitory lease («Conferma dell'esigenza») while it is the landlord's to confirm, the update of the rent by
 * the ISTAT variation («Aggiornamento ISTAT del canone») while the lease is not under the cedolare secca and the communication of the cedolare secca
 * («Opzione per la cedolare secca») while it is, and the withdrawal of the tenant («Recesso dell'inquilino») while it can be recorded or once it was. Each row says where the operation stands in a sentence and opens a
 * window (`?operazione=disdetta`, `rinnovo`, `conferma-esigenza`, `recesso`: a link from the advice or the step of the sheet lands on it) with
 * the two or three fields it needs and, where there is one, the draft of the letter to download. What is computed (the last day a notice is on
 * time, the day a withdrawal ends the lease, where a renewal goes on to) comes from the server. Nothing is sent to the tenant. A person who may
 * not write the leases, a lease with nothing to do and an answer that fails see no section at all: the guide is the guide it was.
 */
export function LeaseOperations({ lease }: LeaseOperationsProps) {
  const { t } = useTranslation();
  const operations = useSheetOperations(lease.id);
  const [searchParams, setSearchParams] = useSearchParams();
  const data = operations.data;

  if (!data) return null;
  const available = availableOperations(data);
  if (!LEASE_OPERATIONS.some((operation) => available[operation])) return null;

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
          {available.rinnovo ? <RenewalRow lease={lease} operations={data} onOpen={() => go('rinnovo')} /> : null}
          {available['conferma-esigenza'] ? <NeedConfirmationRow operations={data} onOpen={() => go('conferma-esigenza')} /> : null}
          {available.istat ? <IstatRow operations={data} onOpen={() => go('istat')} /> : null}
          {available.cedolare ? <CedolareRow operations={data} onOpen={() => go('cedolare')} /> : null}
          {available.recesso ? <WithdrawalRow operations={data} onOpen={() => go('recesso')} /> : null}
        </ul>
      </PlainSection>

      <DisdettaDialog open={open === 'disdetta'} lease={lease} operations={data} onClose={() => go(null)} />
      <RenewalDialog open={open === 'rinnovo'} lease={lease} operations={data} onClose={() => go(null)} />
      <NeedConfirmationDialog open={open === 'conferma-esigenza'} lease={lease} operations={data} onClose={() => go(null)} />
      <IstatDialog open={open === 'istat'} lease={lease} operations={data} onClose={() => go(null)} />
      <CedolareDialog open={open === 'cedolare'} lease={lease} operations={data} onClose={() => go(null)} />
      <WithdrawalDialog open={open === 'recesso'} lease={lease} operations={data} onClose={() => go(null)} />
    </>
  );
}
