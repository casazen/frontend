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
import { useRecordLeaseRenewal } from '@/queries/use-lease-lifecycle';
import type { LeaseDetail, LeaseOperations } from '@/types';
import { longDay } from '../lifecycle/lifecycle-format';
import { PeriodConflictNotice } from '../wizard/period-conflict-notice';
import { letterState } from './operations-model';
import { useLetterDownload } from './use-letter-download';

interface RenewalDialogProps {
  open: boolean;
  lease: LeaseDetail;
  operations: LeaseOperations;
  onClose: () => void;
}

type WindowProps = Omit<RenewalDialogProps, 'open'>;
type RenewalMode = 'standard' | 'agreed';

/**
 * The form that records the renewal. The landlord chooses between the standard renewal (the months of the rules, from the day after the
 * period) and an extension to a day agreed on; the interface says where the contract will end and warns when another lease of the property
 * is in the way (the server decides: it refuses with the same warning and writes nothing). It moves the end of the contract and extends
 * the plan of the rent, so it asks the way the other operations do.
 */
function RenewalForm({ lease, operations, onClose }: WindowProps) {
  const { t, i18n } = useTranslation();
  const record = useRecordLeaseRenewal();
  const renewal = operations.renewal;
  const [mode, setMode] = useState<RenewalMode>('standard');
  const [agreedEnd, setAgreedEnd] = useState('');

  const from = parseStayDate(renewal.startsOn);
  const furthest = parseStayDate(renewal.latestAgreedEnd);
  const standardEnd = parseStayDate(renewal.standardEnd);
  const agreedValid = isStayDate(agreedEnd) && agreedEnd >= from && agreedEnd <= furthest;
  const endsOn = mode === 'standard' ? standardEnd : agreedValid ? agreedEnd : '';

  // The standard renewal runs into the other lease; an agreed end only when it reaches its first day.
  const conflict = renewal.conflict;
  const blocked = conflict !== null && (mode === 'standard' || (agreedValid && agreedEnd >= parseStayDate(conflict.from)));
  const valid = endsOn !== '' && !blocked;

  async function confirm() {
    if (!valid) return;
    try {
      await record.mutateAsync({ leaseId: lease.id, input: mode === 'agreed' ? { newEnd: agreedEnd } : {} });
    } catch {
      return; // The hook told why and read the lease again.
    }
    toast.success(t('leaseOperations.renewal.done', { date: longDay(endsOn, i18n.language) }));
  }

  return (
    <ConfirmationDialog
      open
      onOpenChange={(next) => !next && onClose()}
      title={t('leaseOperations.renewal.dialog.title')}
      description={t('leaseOperations.renewal.dialog.description')}
      confirmLabel={t('leaseOperations.renewal.dialog.confirm')}
      consequences={[t('leaseOperations.renewal.dialog.consequences.plan'), t('leaseOperations.renewal.dialog.consequences.final')]}
      confirmDisabled={!valid}
      isLoading={record.isPending}
      onConfirm={confirm}
    >
      <ChoiceGroup legend={t('leaseOperations.renewal.dialog.modeLegend')} legendVisible>
        <ChoiceCard
          name="lease-renewal-mode"
          value="standard"
          checked={mode === 'standard'}
          onChange={() => setMode('standard')}
          title={t('leaseOperations.renewal.dialog.mode.standard.title')}
          description={t('leaseOperations.renewal.dialog.mode.standard.description', {
            from: longDay(from, i18n.language),
            to: longDay(standardEnd, i18n.language),
            months: renewal.standardMonths,
          })}
        />
        <ChoiceCard
          name="lease-renewal-mode"
          value="agreed"
          checked={mode === 'agreed'}
          onChange={() => setMode('agreed')}
          title={t('leaseOperations.renewal.dialog.mode.agreed.title')}
          description={t('leaseOperations.renewal.dialog.mode.agreed.description')}
        />
      </ChoiceGroup>

      {mode === 'agreed' ? (
        <Field
          label={t('leaseOperations.renewal.dialog.agreedLabel')}
          hint={t('leaseOperations.renewal.dialog.agreedHint')}
          error={
            agreedEnd !== '' && !agreedValid
              ? t('leaseOperations.renewal.dialog.agreedInvalid', { from: longDay(from, i18n.language), to: longDay(furthest, i18n.language) })
              : undefined
          }
        >
          <Input
            type="date"
            value={agreedEnd}
            min={from || undefined}
            max={furthest || undefined}
            onChange={(event) => setAgreedEnd(event.target.value)}
            className="pointer-coarse:h-11"
            data-testid="renewal-agreed-end"
          />
        </Field>
      ) : null}

      {blocked && conflict ? (
        <PeriodConflictNotice
          conflict={{ conflictingLeaseId: conflict.leaseId, conflictingFrom: conflict.from, conflictingTo: conflict.to }}
        />
      ) : null}

      <p className="min-w-0 break-words text-sm" role="status" data-testid="renewal-effect">
        {endsOn !== ''
          ? t('leaseOperations.renewal.dialog.effect', { date: longDay(endsOn, i18n.language) })
          : t('leaseOperations.renewal.dialog.effectPending')}
      </p>
    </ConfirmationDialog>
  );
}

/**
 * What follows a renewal that was recorded: where the contract goes on to, the three things to do next in a line each (the plan of the rent
 * is already extended, the agreement the parties can sign, the communication to the Agenzia delle Entrate within the days of the rules) and
 * the draft of the agreement to download. Nothing is sent to the tenant from here.
 */
function RenewalDone({ lease, operations, onClose }: WindowProps) {
  const { t, i18n } = useTranslation();
  const rules = useLongRentRules().data;
  const { busy, download } = useLetterDownload();
  const recorded = operations.renewal.recorded;
  const letter = letterState(operations, 'Rinnovo');
  if (!recorded) return null;

  const days = rules?.registrationDays;

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-h-[90dvh] sm:overflow-y-auto" data-testid="renewal-done-dialog">
        <div className="flex min-w-0 flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{t('leaseOperations.renewal.doneDialog.title')}</DialogTitle>
            <DialogDescription>
              {t('leaseOperations.renewal.doneDialog.description', {
                from: longDay(recorded.from, i18n.language),
                to: longDay(recorded.to, i18n.language),
              })}
            </DialogDescription>
          </DialogHeader>

          <ol className="min-w-0 list-decimal space-y-2 pl-5 text-sm text-foreground/80" data-testid="renewal-next-steps">
            <li>{t('leaseOperations.renewal.doneDialog.steps.plan')}</li>
            {days === undefined ? null : (
              <li>
                {t('leaseOperations.renewal.doneDialog.steps.communicate', { days })}{' '}
                {t(lease.taxRegime === 'CedolareSecca' ? 'leaseOperations.renewal.doneDialog.steps.taxCedolare' : 'leaseOperations.renewal.doneDialog.steps.taxOrdinary')}
              </li>
            )}
            <li>{t('leaseOperations.renewal.doneDialog.steps.agreement')}</li>
          </ol>

          {letter && !letter.approved ? (
            <p className="text-sm text-foreground/70" data-testid="renewal-draft-note">
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
                    leaseOperationsApi.downloadRinnovo(lease.id, {
                      startsOn: parseStayDate(recorded.from),
                      endsOn: parseStayDate(recorded.to),
                      agreed: recorded.agreed,
                    }),
                  `rinnovo-${lease.id}.pdf`,
                )
              }
              data-testid="renewal-download"
            >
              {t('leaseOperations.renewal.doneDialog.download')}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * The window of the renewal (LR-OPS-1b, `?operazione=rinnovo`): the form that records it while it can be recorded, the next steps once it was
 * (until the next period's window opens: then a new renewal can be recorded and the form is what the row offers). Which of the two is
 * decided when the window opens: recording it closes the window (the toast says where the contract goes on to), and the row of the guide
 * offers the next steps from then on.
 */
export function RenewalDialog({ open, lease, operations, onClose }: RenewalDialogProps) {
  return open ? <RenewalWindow lease={lease} operations={operations} onClose={onClose} /> : null;
}

function RenewalWindow({ lease, operations, onClose }: WindowProps) {
  // Taken once, when the window opens: the form must not turn into the next steps under the hands of who just confirmed it.
  const [startedRecorded] = useState(() => !operations.renewal.available && operations.renewal.recorded !== null);
  return startedRecorded ? (
    <RenewalDone lease={lease} operations={operations} onClose={onClose} />
  ) : (
    <RenewalForm lease={lease} operations={operations} onClose={onClose} />
  );
}
