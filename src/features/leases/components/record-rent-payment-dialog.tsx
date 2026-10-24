import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { toast } from 'sonner';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { holdForUndo } from '@/lib/hold-for-undo';
import { isStayDate, todayInRome } from '@/lib/stay-dates';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useLeases } from '@/queries/use-leases';
import { useRentLedger } from '@/queries/use-rent';
import { useRentRegisterActions } from '@/queries/use-rent-register';
import type { LeaseSummary, RentInstallment, RentRegisterRow } from '@/types';
import { leasePropertyLine, leaseTenantName } from '../lib/lease-list-format';
import { isOpenInstallment, paymentKey, shortDay } from '../lib/rent-register';

/** How the money came, as the landlord says it: it is written in the note of the payment, nothing else changes. */
const METHODS = ['bank', 'cheque', 'cash'] as const;
type Method = (typeof METHODS)[number];

/** The installment being declared paid and who it is about, whichever way the dialog got there. */
interface Target {
  leaseId: string;
  installmentId: string;
  amount: number;
  currency: string;
  periodStart: string;
  periodEnd: string;
  tenant: string;
}

interface RecordRentPaymentDialogProps {
  /** From a row of the register the installment is already chosen. Without it the landlord picks the lease and then the installment. */
  row?: RentRegisterRow;
  onClose: () => void;
}

/** The leases that have a rent plan with something still to collect: the only ones a payment can be declared on. */
function withRentToCollect(leases: readonly LeaseSummary[]): LeaseSummary[] {
  return leases
    .filter((lease) => !!lease.nextRentDueDate)
    .sort((a, b) => (b.overdueRentCount ?? 0) - (a.overdueRentCount ?? 0));
}

/** The installment to declare paid and who it is about: the row it was opened from, or the lease and installment chosen. */
function targetOf(
  t: TFunction,
  row: RentRegisterRow | undefined,
  lease: LeaseSummary | undefined,
  installment: RentInstallment | undefined,
): Target | null {
  if (row) {
    return {
      leaseId: row.leaseId,
      installmentId: row.id,
      amount: row.amount,
      currency: row.currency,
      periodStart: row.periodStart,
      periodEnd: row.periodEnd,
      tenant: leaseTenantName(row, t),
    };
  }
  if (!lease || !installment) return null;
  return {
    leaseId: lease.id,
    installmentId: installment.id,
    amount: installment.amount,
    currency: installment.currency,
    periodStart: installment.periodStart,
    periodEnd: installment.periodEnd,
    tenant: leaseTenantName(lease, t),
  };
}

/**
 * A payment received outside CasaZen (bank transfer, cheque, cash), declared by the landlord (LR-04b). The whole installment: a
 * partial payment is not a thing here. From a row the installment is known; from the button of the page there are two steps, the
 * lease and then its open installment. There is no way to take a declared payment back, so it waits six seconds after the
 * landlord confirms, with an «Annulla» that is true (`holdForUndo`: nothing is recorded until they pass).
 */
export function RecordRentPaymentDialog({ row, onClose }: RecordRentPaymentDialogProps) {
  const { t, i18n } = useTranslation();
  const actions = useRentRegisterActions();
  const today = todayInRome();

  const [chosenLeaseId, setChosenLeaseId] = useState('');
  const [chosenInstallmentId, setChosenInstallmentId] = useState('');
  const [paidOn, setPaidOn] = useState(today);
  const [method, setMethod] = useState<Method | ''>('');

  // Without a row: the leases to choose from, and the open installments of the one chosen.
  const leasesQuery = useLeases(undefined, { enabled: !row });
  const candidates = withRentToCollect(leasesQuery.data ?? []);
  const leaseId = row ? row.leaseId : chosenLeaseId || (candidates.length === 1 ? candidates[0].id : '');
  const lease = candidates.find((candidate) => candidate.id === leaseId);
  const ledgerQuery = useRentLedger(row ? '' : leaseId);
  const ledger = ledgerQuery.data;
  const open: RentInstallment[] =
    ledger?.schedule?.isActive === true
      ? ledger.installments.filter((installment) => isOpenInstallment(installment.status)).sort((a, b) => a.dueDate.localeCompare(b.dueDate))
      : [];
  const installment = open.find((candidate) => candidate.id === chosenInstallmentId) ?? open[0];

  const target = targetOf(t, row, lease, installment);

  const dateValid = isStayDate(paidOn) && paidOn <= today;
  const canSubmit = target !== null && dateValid;

  function submit() {
    if (!target || !dateValid) return;
    const payment = target;
    const amount = formatCurrency(payment.amount, payment.currency);
    const started = holdForUndo({
      key: paymentKey(payment.installmentId),
      message: t('longRentRents.pay.held', { amount, tenant: payment.tenant }),
      description: t('longRentRents.pay.heldHint'),
      commit: async () => {
        await actions.markPaid(payment.leaseId, payment.installmentId, {
          paidOn,
          note: method === '' ? undefined : t(`longRentRents.pay.methods.${method}`),
        });
        toast.success(t('longRentRents.pay.done', { amount, tenant: payment.tenant }));
      },
    });
    // The same payment is already being recorded: tell, never a click that seems to do nothing.
    if (!started) toast.info(t('longRentRents.alreadyHeld'));
    onClose();
  }

  const loading = !row && (leasesQuery.isLoading || (leaseId !== '' && ledgerQuery.isLoading));
  const failed = !row && (leasesQuery.isError || ledgerQuery.isError);

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent data-testid="record-rent-payment-dialog">
        <DialogHeader>
          <DialogTitle>{t('longRentRents.pay.title')}</DialogTitle>
          <DialogDescription>
            {target
              ? t('longRentRents.pay.description', {
                  amount: formatCurrency(target.amount, target.currency),
                  tenant: target.tenant,
                  from: formatDate(target.periodStart),
                  to: formatDate(target.periodEnd),
                })
              : t('longRentRents.pay.descriptionGeneral')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {failed ? (
            <Alert
              variant="danger"
              action={
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => void (leasesQuery.isError ? leasesQuery.refetch() : ledgerQuery.refetch())}
                >
                  {t('longRentRents.retry')}
                </Button>
              }
            >
              {t('longRentRents.pay.loadError')}
            </Alert>
          ) : null}

          {!row && !failed ? (
            <>
              {loading && leaseId === '' ? <p className="text-sm text-foreground/70">{t('longRentRents.pay.loading')}</p> : null}
              {!loading && candidates.length === 0 ? (
                <p className="text-sm text-foreground/70" data-testid="record-rent-payment-none">
                  {t('longRentRents.pay.noneToCollect')}
                </p>
              ) : null}
              {candidates.length > 0 ? (
                <Field label={t('longRentRents.pay.lease')}>
                  <Select
                    value={leaseId}
                    onChange={(event) => {
                      setChosenLeaseId(event.target.value);
                      setChosenInstallmentId('');
                    }}
                  >
                    <option value="" disabled>
                      {t('longRentRents.pay.leasePlaceholder')}
                    </option>
                    {candidates.map((candidate) => (
                      <option key={candidate.id} value={candidate.id}>
                        {leaseTenantName(candidate, t)} · {leasePropertyLine(candidate, t)}
                      </option>
                    ))}
                  </Select>
                </Field>
              ) : null}
              {leaseId !== '' && !ledgerQuery.isLoading && !ledgerQuery.isError && open.length === 0 ? (
                <p className="text-sm text-foreground/70">{t('longRentRents.pay.noOpenInstallment')}</p>
              ) : null}
              {open.length > 0 ? (
                <Field label={t('longRentRents.pay.installment')}>
                  <Select value={installment?.id ?? ''} onChange={(event) => setChosenInstallmentId(event.target.value)}>
                    {open.map((candidate) => (
                      <option key={candidate.id} value={candidate.id}>
                        {t('longRentRents.pay.installmentOption', {
                          due: shortDay(candidate.dueDate, i18n.language),
                          amount: formatCurrency(candidate.amount, candidate.currency),
                        })}
                        {candidate.isOverdue ? ` · ${t('longRentRents.pay.overdue')}` : ''}
                      </option>
                    ))}
                  </Select>
                </Field>
              ) : null}
            </>
          ) : null}

          {target ? (
            <>
              <p className="text-sm" data-testid="record-rent-payment-amount">
                {t('longRentRents.pay.wholeInstallment', { amount: formatCurrency(target.amount, target.currency) })}
              </p>
              <Field
                label={t('longRentRents.pay.date')}
                error={dateValid ? undefined : t('longRentRents.pay.dateInvalid', { today: formatDate(today) })}
              >
                <Input type="date" value={paidOn} max={today} onChange={(event) => setPaidOn(event.target.value)} />
              </Field>
              <Field label={t('longRentRents.pay.method')} optional hint={t('longRentRents.pay.methodHint')}>
                <Select value={method} onChange={(event) => setMethod(event.target.value as Method | '')}>
                  <option value="">{t('longRentRents.pay.methodNone')}</option>
                  {METHODS.map((value) => (
                    <option key={value} value={value}>
                      {t(`longRentRents.pay.methods.${value}`)}
                    </option>
                  ))}
                </Select>
              </Field>
            </>
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            {t('longRentRents.cancel')}
          </Button>
          <Button type="button" onClick={submit} disabled={!canSubmit} data-testid="record-rent-payment-submit">
            {t('longRentRents.pay.submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
