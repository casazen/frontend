import { useMemo, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { leaseOperationsApi } from '@/api/lease-operations.api';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { getProblemMessage } from '@/lib/api-errors';
import { isStayDate, parseStayDate, todayInRome } from '@/lib/stay-dates';
import { formatCurrency } from '@/lib/utils';
import { useDepositCalculation, useRecordDepositReturn } from '@/queries/use-lease-operations';
import type { DepositRate, DepositReturnInput, LeaseDepositDeduction, LeaseDetail, LeaseOperations } from '@/types';
import { Disclosure } from '../guide/disclosure';
import { longDay } from '../lifecycle/lifecycle-format';
import { LetterSentForm } from './letter-sent-form';
import { formatPercent, letterState, parseAmount, parsePercent, yearsHeld } from './operations-model';
import { useLetterDownload } from './use-letter-download';

/** How long the form stands still before the server is asked to work the statement out. */
const CALCULATION_DELAY_MS = 400;

/** The longest reason of a sum kept the interface lets through (the server bounds it too). */
const MAX_REASON_LENGTH = 200;

interface DepositDialogProps {
  open: boolean;
  lease: LeaseDetail;
  operations: LeaseOperations;
  onClose: () => void;
}

/** A sum kept from the deposit as it is typed: the texts are parsed when the statement is asked for, not while the person writes. */
interface DeductionRow {
  id: number;
  reason: string;
  amount: string;
}

function DepositBody({ lease, operations, onClose }: Omit<DepositDialogProps, 'open'>) {
  const { t, i18n } = useTranslation();
  const deposit = operations.deposit;
  const letter = letterState(operations, 'RestituzioneCauzione');
  const { busy, download } = useLetterDownload();
  const record = useRecordDepositReturn(lease.id);
  const today = todayInRome();

  const minPaid = parseStayDate(deposit.minPaidOn);
  const maxReturn = parseStayDate(deposit.maxReturnOn);
  const [paidOn, setPaidOn] = useState(() => parseStayDate(deposit.paidOn));
  const [returnedOn, setReturnedOn] = useState(() => parseStayDate(deposit.suggestedReturnOn));
  const [rateTexts, setRateTexts] = useState<Record<number, string>>({});
  const [interestPaidText, setInterestPaidText] = useState('');
  const [rows, setRows] = useState<DeductionRow[]>([]);
  const [nextRowId, setNextRowId] = useState(1);
  const [confirming, setConfirming] = useState(false);

  const datesValid =
    isStayDate(paidOn) && isStayDate(returnedOn) && (minPaid === '' || paidOn >= minPaid) && paidOn < returnedOn && (maxReturn === '' || returnedOn <= maxReturn);
  const years = useMemo(() => (datesValid ? yearsHeld(paidOn, returnedOn) : []), [datesValid, paidOn, returnedOn]);

  // The statement asked for: every year has its rate, the sums are sums. An empty row of the sums kept is nothing; half a row is not valid yet.
  const input = useMemo<DepositReturnInput | null>(() => {
    if (!datesValid) return null;

    const rates: DepositRate[] = [];
    for (const year of years) {
      const ratePercent = parsePercent(rateTexts[year] ?? '');
      if (ratePercent === null) return null;
      rates.push({ year, ratePercent });
    }

    const interestPaid = interestPaidText.trim() === '' ? 0 : parseAmount(interestPaidText);
    if (interestPaid === null) return null;

    const deductions: LeaseDepositDeduction[] = [];
    for (const row of rows) {
      const reason = row.reason.trim();
      if (reason === '' && row.amount.trim() === '') continue;
      const amount = parseAmount(row.amount);
      if (reason === '' || amount === null || amount <= 0) return null;
      deductions.push({ reason, amount });
    }

    return { returnedOn, depositPaidOn: paidOn, rates, ...(interestPaid > 0 ? { interestPaid } : {}), deductions };
  }, [datesValid, years, rateTexts, interestPaidText, rows, returnedOn, paidOn]);

  const settled = useDebouncedValue(input, CALCULATION_DELAY_MS);
  const calculation = useDepositCalculation(lease.id, settled);

  // The statement on screen is the one of the form on screen: while the next answer arrives nothing stale is shown or can be used.
  const fresh = input !== null && JSON.stringify(settled) === JSON.stringify(input);
  const result = fresh ? calculation.data : undefined;
  const refusal = fresh && !result && calculation.error ? getProblemMessage(calculation.error, t) : undefined;

  const canRecord = result !== undefined && returnedOn <= today;

  function setRate(year: number, text: string) {
    setRateTexts((current) => ({ ...current, [year]: text }));
  }

  function changeRow(id: number, change: Partial<DeductionRow>) {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, ...change } : row)));
  }

  async function confirmRecord() {
    if (!input || !result) return;
    try {
      await record.mutateAsync(input);
    } catch {
      return; // The hook told why.
    }
    toast.success(t('leaseOperations.deposit.recorded', { amount: formatCurrency(result.returned), date: longDay(returnedOn, i18n.language) }));
    onClose();
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <DialogHeader>
        <DialogTitle>{t('leaseOperations.deposit.dialog.title')}</DialogTitle>
        <DialogDescription>{t('leaseOperations.deposit.dialog.description', { amount: formatCurrency(deposit.amount) })}</DialogDescription>
      </DialogHeader>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t('leaseOperations.deposit.dialog.paidOnLabel')}>
          <Input
            type="date"
            value={paidOn}
            min={minPaid || undefined}
            onChange={(event) => setPaidOn(event.target.value)}
            className="pointer-coarse:h-11"
            data-testid="deposit-paid-on"
          />
        </Field>
        <Field
          label={t('leaseOperations.deposit.dialog.returnedOnLabel')}
          error={isStayDate(paidOn) && isStayDate(returnedOn) && !datesValid ? t('leaseOperations.deposit.dialog.datesInvalid') : undefined}
        >
          <Input
            type="date"
            value={returnedOn}
            max={maxReturn || undefined}
            onChange={(event) => setReturnedOn(event.target.value)}
            className="pointer-coarse:h-11"
            data-testid="deposit-returned-on"
          />
        </Field>
      </div>

      {years.length > 0 ? (
        <section className="min-w-0 space-y-2" aria-labelledby="deposit-rates-title">
          <h3 id="deposit-rates-title" className="text-sm font-semibold">
            {t('leaseOperations.deposit.dialog.ratesTitle')}
          </h3>
          <p className="text-sm text-foreground/70">{t('leaseOperations.deposit.dialog.rateHint')}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {years.map((year) => (
              <Field
                key={year}
                label={t('leaseOperations.deposit.dialog.rateLabel', { year })}
                error={(rateTexts[year] ?? '').trim() !== '' && parsePercent(rateTexts[year] ?? '') === null ? t('leaseOperations.deposit.dialog.rateInvalid') : undefined}
              >
                <Input
                  inputMode="decimal"
                  autoComplete="off"
                  value={rateTexts[year] ?? ''}
                  onChange={(event) => setRate(year, event.target.value)}
                  className="pointer-coarse:h-11"
                  data-testid={`deposit-rate-${year}`}
                />
              </Field>
            ))}
          </div>
        </section>
      ) : null}

      <Field
        label={t('leaseOperations.deposit.dialog.interestPaidLabel')}
        hint={t('leaseOperations.deposit.dialog.interestPaidHint')}
        error={interestPaidText.trim() !== '' && parseAmount(interestPaidText) === null ? t('leaseOperations.deposit.dialog.amountInvalid') : undefined}
      >
        <Input
          inputMode="decimal"
          autoComplete="off"
          value={interestPaidText}
          onChange={(event) => setInterestPaidText(event.target.value)}
          className="pointer-coarse:h-11"
          data-testid="deposit-interest-paid"
        />
      </Field>

      <Disclosure summary={t('leaseOperations.deposit.dialog.deductionsTitle')} testId="deposit-deductions">
        <p className="text-foreground/70">{t('leaseOperations.deposit.dialog.deductionsHint')}</p>
        {rows.map((row) => (
          <div key={row.id} className="grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_8rem_auto]">
            <Input
              aria-label={t('leaseOperations.deposit.dialog.reasonLabel')}
              placeholder={t('leaseOperations.deposit.dialog.reasonLabel')}
              maxLength={MAX_REASON_LENGTH}
              value={row.reason}
              onChange={(event) => changeRow(row.id, { reason: event.target.value })}
              className="pointer-coarse:h-11"
              data-testid={`deposit-deduction-reason-${row.id}`}
            />
            <Input
              aria-label={t('leaseOperations.deposit.dialog.amountLabel')}
              placeholder={t('leaseOperations.deposit.dialog.amountLabel')}
              inputMode="decimal"
              autoComplete="off"
              value={row.amount}
              onChange={(event) => changeRow(row.id, { amount: event.target.value })}
              className="pointer-coarse:h-11"
              data-testid={`deposit-deduction-amount-${row.id}`}
            />
            <Button
              type="button"
              variant="ghost"
              className="min-h-11 min-w-11"
              aria-label={t('leaseOperations.deposit.dialog.removeDeduction')}
              onClick={() => setRows((current) => current.filter((other) => other.id !== row.id))}
            >
              <Trash2 aria-hidden="true" className="size-4" />
            </Button>
          </div>
        ))}
        {rows.length < deposit.maxDeductions ? (
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            onClick={() => {
              setRows((current) => [...current, { id: nextRowId, reason: '', amount: '' }]);
              setNextRowId((current) => current + 1);
            }}
            data-testid="deposit-add-deduction"
          >
            {t('leaseOperations.deposit.dialog.addDeduction')}
          </Button>
        ) : null}
      </Disclosure>

      <div className="min-w-0 space-y-1 text-sm" role="status" data-testid="deposit-result">
        {result ? (
          <>
            <p className="break-words font-medium">
              {t('leaseOperations.deposit.dialog.result', {
                returned: formatCurrency(result.returned),
                deposit: formatCurrency(result.deposit),
                interest: formatCurrency(result.interestDue),
                deductions: formatCurrency(result.deductionsTotal),
              })}
            </p>
            <ul role="list" className="list-disc space-y-0.5 pl-5 text-foreground/80" data-testid="deposit-years">
              {result.years.map((y) => (
                <li key={y.year}>
                  {t('leaseOperations.deposit.dialog.yearLine', {
                    year: y.year,
                    rate: formatPercent(y.ratePercent, i18n.language),
                    days: y.days,
                    interest: formatCurrency(y.interest),
                  })}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="break-words">{refusal ?? t('leaseOperations.deposit.dialog.resultPending')}</p>
        )}
      </div>

      {letter && !letter.approved ? (
        <p className="text-sm text-foreground/70" data-testid="deposit-draft-note">
          {t('leaseOperations.draftNote')}
        </p>
      ) : null}

      {confirming && result ? (
        <div className="min-w-0 space-y-2 rounded-lg border border-border p-3 text-sm" data-testid="deposit-confirm">
          <p className="break-words">
            {t('leaseOperations.deposit.dialog.confirmText', { amount: formatCurrency(result.returned), date: longDay(returnedOn, i18n.language) })}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" className="min-h-11" onClick={() => setConfirming(false)}>
              {t('leaseOperations.deposit.dialog.confirmNo')}
            </Button>
            <Button type="button" className="min-h-11" loading={record.isPending} onClick={() => void confirmRecord()} data-testid="deposit-confirm-yes">
              {t('leaseOperations.deposit.dialog.confirmYes')}
            </Button>
          </div>
        </div>
      ) : null}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          {t('shared.close')}
        </Button>
        <Button
          type="button"
          variant="outline"
          loading={busy}
          disabled={!result || !input}
          onClick={() => {
            if (!input) return;
            void download(() => leaseOperationsApi.downloadRestituzioneCauzione(lease.id, input), `restituzione-cauzione-${lease.id}.pdf`);
          }}
          data-testid="deposit-download"
        >
          {t('leaseOperations.deposit.dialog.download')}
        </Button>
        <Button type="button" disabled={!canRecord} onClick={() => setConfirming(true)} data-testid="deposit-record">
          {t('leaseOperations.deposit.dialog.record')}
        </Button>
      </DialogFooter>
      {result && returnedOn > today ? <p className="text-sm text-foreground/70">{t('leaseOperations.deposit.dialog.recordFuture')}</p> : null}

      <Disclosure summary={t('leaseOperations.sent.title')} testId="deposit-after">
        <LetterSentForm leaseId={lease.id} startDate={lease.startDate} kind="RestituzioneCauzione" sent={letter?.sent ?? null} />
      </Disclosure>
    </div>
  );
}

/**
 * «Restituzione della cauzione» (LR-OPS-1c): the window of the statement of the return of the security deposit, offered once the lease is ending and
 * has a deposit. The landlord writes the day it is returned (and the day it was paid, the start of the lease unless he says another), the legal
 * interest rate of each calendar year it was held (CasaZen does not know them: they change every year), the interest he already paid and, if he
 * keeps something, the sums with their reasons; the server works the statement out to the cent while he writes, the same numbers the draft for the
 * tenant carries and the record keeps. «Registra la restituzione» writes one line in the history of the lease (it asks first, and only for a day that
 * has already come): CasaZen moves no money and does not change the deposit. Controlled by the address (`?operazione=cauzione`); its content is
 * forgotten when it closes.
 */
export function DepositDialog({ open, lease, operations, onClose }: DepositDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-h-[90dvh] sm:overflow-y-auto" data-testid="deposit-dialog">
        <DepositBody lease={lease} operations={operations} onClose={onClose} />
      </DialogContent>
    </Dialog>
  );
}
