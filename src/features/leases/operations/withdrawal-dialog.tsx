import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { leaseOperationsApi } from '@/api/lease-operations.api';
import { ConfirmationDialog } from '@/components/shared/confirmation-dialog';
import { Button } from '@/components/ui/button';
import { ChoiceCard, ChoiceGroup } from '@/components/ui/choice-card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { isStayDate, parseStayDate } from '@/lib/stay-dates';
import { useLongRentRules } from '@/queries/use-lease-draft';
import { useRecordTenantWithdrawal } from '@/queries/use-lease-lifecycle';
import { TENANT_WITHDRAWAL_REASONS, type LeaseDetail, type LeaseOperations, type TenantWithdrawalReason } from '@/types';
import { Disclosure } from '../guide/disclosure';
import { leaseTermEnd, longDay } from '../lifecycle/lifecycle-format';
import { addMonths } from '../wizard/wizard-model';
import { LetterSentForm } from './letter-sent-form';
import { letterState } from './operations-model';
import { useLetterDownload } from './use-letter-download';

interface WithdrawalDialogProps {
  open: boolean;
  lease: LeaseDetail;
  operations: LeaseOperations;
  onClose: () => void;
}

type WindowProps = Omit<WithdrawalDialogProps, 'open'>;

/**
 * The form that records the withdrawal the tenant sent. The landlord gives the day the letter arrived and why; the interface works out where
 * the lease ends with the months of the rules (a preview of what the server computes, which has the last word) and refuses to go on when the
 * notice would run out after the period the lease is in. It ends the lease for good, so it asks the way the early termination does.
 */
function WithdrawalForm({ lease, operations, onClose }: WindowProps) {
  const { t, i18n } = useTranslation();
  const rules = useLongRentRules().data;
  const record = useRecordTenantWithdrawal();
  const withdrawal = operations.withdrawal;
  const [receivedOn, setReceivedOn] = useState('');
  const [reason, setReason] = useState<TenantWithdrawalReason>('GraveMotivi');
  const [months, setMonths] = useState('');

  const rulesMonths = rules?.noticeMonths;
  // Serious reasons take the notice of the rules whatever is typed; the contractual faculty takes the one the contract states.
  const noticeMonths = reason === 'ContractualFaculty' && months !== '' ? Number(months) : rulesMonths;
  const monthsValid =
    noticeMonths !== undefined && Number.isInteger(noticeMonths) && noticeMonths >= 1 && noticeMonths <= withdrawal.maxContractualNoticeMonths;

  const min = parseStayDate(withdrawal.minReceivedOn);
  const max = parseStayDate(withdrawal.maxReceivedOn);
  const dateValid = isStayDate(receivedOn) && (min === '' || receivedOn >= min) && (max === '' || receivedOn <= max);

  const effectiveOn = dateValid && monthsValid ? addMonths(receivedOn, noticeMonths) : '';
  const periodEnd = parseStayDate(leaseTermEnd(lease));
  // The notice runs out after the period the lease is in: it is not an early ending, and the server would refuse it.
  const beyondPeriod = effectiveOn !== '' && periodEnd !== '' && effectiveOn > periodEnd;
  const valid = effectiveOn !== '' && !beyondPeriod;

  async function confirm() {
    if (!valid || noticeMonths === undefined) return;
    try {
      await record.mutateAsync({
        leaseId: lease.id,
        input: { receivedOn, reason, ...(reason === 'ContractualFaculty' ? { noticeMonths } : {}) },
      });
    } catch {
      return; // The hook told why and read the lease again.
    }
    toast.success(t('leaseOperations.withdrawal.done', { date: longDay(effectiveOn, i18n.language) }));
  }

  return (
    <ConfirmationDialog
      open
      onOpenChange={(next) => !next && onClose()}
      title={t('leaseOperations.withdrawal.dialog.title')}
      description={t('leaseOperations.withdrawal.dialog.description')}
      variant="destructive"
      confirmLabel={t('leaseOperations.withdrawal.dialog.confirm')}
      requireText={t('leaseOperations.withdrawal.dialog.word')}
      consequences={[
        t('leaseOperations.withdrawal.dialog.consequences.final'),
        t('leaseOperations.withdrawal.dialog.consequences.rent'),
        t('leaseOperations.withdrawal.dialog.consequences.letter'),
      ]}
      confirmDisabled={!valid}
      isLoading={record.isPending}
      onConfirm={confirm}
    >
      <Field
        label={t('leaseOperations.withdrawal.dialog.receivedLabel')}
        hint={t('leaseOperations.withdrawal.dialog.receivedHint')}
        error={receivedOn !== '' && !dateValid ? t('leaseOperations.withdrawal.dialog.receivedInvalid') : undefined}
      >
        <Input
          type="date"
          value={receivedOn}
          min={min || undefined}
          max={max || undefined}
          onChange={(event) => setReceivedOn(event.target.value)}
          className="pointer-coarse:h-11"
          data-testid="withdrawal-received"
        />
      </Field>

      <ChoiceGroup legend={t('leaseOperations.withdrawal.dialog.reasonLegend')} legendVisible>
        {TENANT_WITHDRAWAL_REASONS.map((option) => (
          <ChoiceCard
            key={option}
            name="lease-withdrawal-reason"
            value={option}
            checked={reason === option}
            onChange={() => setReason(option)}
            title={t(`leaseOperations.withdrawal.reasons.${option}.title`)}
            description={t(`leaseOperations.withdrawal.reasons.${option}.description`)}
          />
        ))}
      </ChoiceGroup>

      {reason === 'ContractualFaculty' ? (
        <Field
          label={t('leaseOperations.withdrawal.dialog.monthsLabel')}
          hint={t('leaseOperations.withdrawal.dialog.monthsHint')}
          error={months !== '' && !monthsValid ? t('leaseOperations.withdrawal.dialog.monthsInvalid', { max: withdrawal.maxContractualNoticeMonths }) : undefined}
        >
          <Input
            type="number"
            inputMode="numeric"
            min={1}
            max={withdrawal.maxContractualNoticeMonths}
            value={months}
            placeholder={rulesMonths === undefined ? undefined : String(rulesMonths)}
            onChange={(event) => setMonths(event.target.value)}
            className="pointer-coarse:h-11"
            data-testid="withdrawal-months"
          />
        </Field>
      ) : null}

      <p className="min-w-0 break-words text-sm" role="status" data-testid="withdrawal-effect">
        {beyondPeriod
          ? t('leaseOperations.withdrawal.dialog.beyond', { date: longDay(effectiveOn, i18n.language), end: longDay(periodEnd, i18n.language) })
          : effectiveOn !== ''
            ? t('leaseOperations.withdrawal.dialog.effect', { date: longDay(effectiveOn, i18n.language) })
            : t('leaseOperations.withdrawal.dialog.effectPending')}
      </p>
    </ConfirmationDialog>
  );
}

/**
 * What follows a withdrawal that was recorded: where the lease ends, the draft of the landlord's acknowledgement to download, and the three
 * things to do next in one line each (concord the handover, communicate the end to the Agenzia delle Entrate within the days of the rules,
 * return the deposit). Nothing is sent to the tenant from here.
 */
function WithdrawalDone({ lease, operations, onClose }: WindowProps) {
  const { t, i18n } = useTranslation();
  const rules = useLongRentRules().data;
  const { busy, download } = useLetterDownload();
  const recorded = operations.withdrawal.recorded;
  const letter = letterState(operations, 'PresaAttoRecesso');
  if (!recorded) return null;

  const days = rules?.registrationDays;

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-h-[90dvh] sm:overflow-y-auto" data-testid="withdrawal-done-dialog">
        <div className="flex min-w-0 flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{t('leaseOperations.withdrawal.doneDialog.title')}</DialogTitle>
            <DialogDescription>
              {t('leaseOperations.withdrawal.doneDialog.description', {
                received: longDay(recorded.receivedOn, i18n.language),
                date: longDay(recorded.effectiveOn, i18n.language),
              })}
            </DialogDescription>
          </DialogHeader>

          <ol className="min-w-0 list-decimal space-y-2 pl-5 text-sm text-foreground/80" data-testid="withdrawal-next-steps">
            <li>{t('leaseOperations.withdrawal.doneDialog.steps.letter')}</li>
            <li>{t('leaseOperations.withdrawal.doneDialog.steps.handover')}</li>
            {days === undefined ? null : (
              <li>
                {t('leaseOperations.withdrawal.doneDialog.steps.communicate', { days })}{' '}
                {t(lease.taxRegime === 'CedolareSecca' ? 'leaseOperations.withdrawal.doneDialog.steps.taxCedolare' : 'leaseOperations.withdrawal.doneDialog.steps.taxOrdinary')}
              </li>
            )}
          </ol>

          {letter && !letter.approved ? (
            <p className="text-sm text-foreground/70" data-testid="withdrawal-draft-note">
              {t('leaseOperations.draftNote')}
            </p>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t('shared.close')}
            </Button>
            <Button
              type="button"
              loading={busy}
              onClick={() =>
                void download(
                  () =>
                    leaseOperationsApi.downloadPresaAttoRecesso(lease.id, {
                      receivedOn: parseStayDate(recorded.receivedOn),
                      reason: recorded.reason,
                      noticeMonths: recorded.noticeMonths,
                    }),
                  `presa-atto-recesso-${lease.id}.pdf`,
                )
              }
              data-testid="withdrawal-download"
            >
              {t('leaseOperations.withdrawal.doneDialog.download')}
            </Button>
          </DialogFooter>

          <Disclosure summary={t('leaseOperations.sent.title')} testId="withdrawal-after">
            <LetterSentForm leaseId={lease.id} startDate={lease.startDate} kind="PresaAttoRecesso" sent={letter?.sent ?? null} />
          </Disclosure>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * The window of the withdrawal of the tenant (LR-OPS-1, `?operazione=recesso`): the form that records it while it is not recorded, the
 * next steps once it is. Which of the two is decided when the window opens: recording it closes the window (the toast says where the lease
 * ends), and the row of the guide offers the next steps from then on.
 */
export function WithdrawalDialog({ open, lease, operations, onClose }: WithdrawalDialogProps) {
  return open ? <WithdrawalWindow lease={lease} operations={operations} onClose={onClose} /> : null;
}

function WithdrawalWindow({ lease, operations, onClose }: WindowProps) {
  // Taken once, when the window opens: the form must not turn into the next steps under the hands of who just confirmed it.
  const [startedRecorded] = useState(() => operations.withdrawal.recorded !== null);
  return startedRecorded ? (
    <WithdrawalDone lease={lease} operations={operations} onClose={onClose} />
  ) : (
    <WithdrawalForm lease={lease} operations={operations} onClose={onClose} />
  );
}
