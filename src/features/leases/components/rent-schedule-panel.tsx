import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertCircle, Loader2 } from 'lucide-react';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getProblemMessage } from '@/lib/api-errors';
import { romeDateOf } from '@/lib/stay-dates';
import { formatCurrency, formatDate } from '@/lib/utils';
import {
  useConfigureRentSchedule,
  useDisableRentSchedule,
  useRentLedger,
  useSendRentPaymentRequest,
} from '@/queries/use-rent';
import type { RentCadence, RentInstallment, RentLedger } from '@/types';
import { MarkRentPaidDialog } from './mark-rent-paid-dialog';

const SELECT_CLASS =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

const RENT_CADENCES: RentCadence[] = ['Monthly', 'Bimonthly', 'Quarterly', 'Semiannual'];

const MONTHS_PER: Record<RentCadence, number> = { Monthly: 1, Bimonthly: 2, Quarterly: 3, Semiannual: 6 };

/** Payments settings page, where the Stripe Connect onboarding happens (BK-09). */
const PAYMENTS_SETTINGS_PATH = '/app/short-rent/settings/payments';

interface RentSchedulePanelProps {
  leaseId: string;
}

/**
 * Recurring rent of a lease (LT-06, #269): schedule generated from the lease, installments with their real state (to
 * collect, in progress, paid online or offline, failed, cancelled), payment link to the tenant and offline payments.
 */
export function RentSchedulePanel({ leaseId }: RentSchedulePanelProps) {
  const { t } = useTranslation();
  const { data: ledger, isLoading, isError, error, refetch, isFetching } = useRentLedger(leaseId);

  return (
    <Card data-testid="rent-schedule-panel">
      <CardHeader>
        <CardTitle>{t('rent.title')}</CardTitle>
        <CardDescription>{t('rent.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground" data-testid="rent-loading">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t('rent.loading')}
          </p>
        )}
        {isError && (
          <div className="space-y-2" role="alert" data-testid="rent-load-error">
            <p className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" />
              {getProblemMessage(error, t) ?? t('rent.loadError')}
            </p>
            <Button size="sm" variant="outline" onClick={() => void refetch()} disabled={isFetching}>
              {t('rent.retry')}
            </Button>
          </div>
        )}
        {ledger && <RentLedgerContent leaseId={leaseId} ledger={ledger} />}
      </CardContent>
    </Card>
  );
}

function RentLedgerContent({ leaseId, ledger }: { leaseId: string; ledger: RentLedger }) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const disable = useDisableRentSchedule(leaseId);
  const schedule = ledger.schedule;

  if (!ledger.canConfigure && !schedule) {
    return (
      <p className="text-sm text-muted-foreground" data-testid="rent-not-signed">
        {t('rent.notSignedYet')}
      </p>
    );
  }

  const showForm = ledger.canConfigure && (!schedule || editing || !schedule.isActive);

  return (
    <div className="space-y-4">
      {!ledger.onlinePaymentsAvailable && (
        <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm" data-testid="rent-online-unavailable">
          {t('rent.onlineUnavailable')}{' '}
          <Link to={PAYMENTS_SETTINGS_PATH} className="font-medium underline">
            {t('rent.onlineUnavailableLink')}
          </Link>
        </p>
      )}
      {ledger.onlinePaymentsAvailable && !ledger.hasTenantEmail && (
        <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm" data-testid="rent-no-tenant-email">
          {t('rent.noTenantEmail')}
        </p>
      )}

      {schedule && !showForm && (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm" data-testid="rent-schedule-summary">
          <p>
            {t('rent.summary', {
              cadence: t(`rent.cadence.${schedule.cadence}`),
              amount: formatCurrency(schedule.amount, schedule.currency),
              day: schedule.billingDayOfMonth,
            })}
          </p>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
              {t('rent.edit')}
            </Button>
            <Button size="sm" variant="outline" onClick={() => disable.mutate()} disabled={disable.isPending}>
              {t('rent.disable')}
            </Button>
          </div>
        </div>
      )}
      {schedule && !schedule.isActive && (
        <p className="text-sm text-muted-foreground" data-testid="rent-schedule-disabled">
          {t('rent.scheduleInactive')}
        </p>
      )}

      {showForm && (
        <RentScheduleForm
          leaseId={leaseId}
          ledger={ledger}
          onDone={() => setEditing(false)}
          onCancel={schedule?.isActive ? () => setEditing(false) : undefined}
        />
      )}

      {ledger.partialFinalPeriod && (
        <p className="text-sm text-muted-foreground" data-testid="rent-partial-period">
          {t('rent.partialFinalPeriod', {
            start: formatDate(ledger.partialFinalPeriod.start),
            end: formatDate(ledger.partialFinalPeriod.end),
          })}
        </p>
      )}

      {schedule && <InstallmentsTable leaseId={leaseId} ledger={ledger} />}
    </div>
  );
}

interface RentScheduleFormProps {
  leaseId: string;
  ledger: RentLedger;
  onDone: () => void;
  onCancel?: () => void;
}

function RentScheduleForm({ leaseId, ledger, onDone, onCancel }: RentScheduleFormProps) {
  const { t } = useTranslation();
  const configure = useConfigureRentSchedule(leaseId);
  const [cadence, setCadence] = useState<RentCadence>(ledger.schedule?.cadence ?? 'Monthly');
  const [billingDay, setBillingDay] = useState(ledger.schedule ? String(ledger.schedule.billingDayOfMonth) : '');
  const [amount, setAmount] = useState(ledger.schedule ? String(ledger.schedule.amount) : '');

  const defaultAmount = ledger.monthlyRent * MONTHS_PER[cadence];
  const dayNumber = Number(billingDay);
  const dayValid = billingDay === '' || (Number.isInteger(dayNumber) && dayNumber >= 1 && dayNumber <= 28);
  const amountNumber = Number(amount.replace(',', '.'));
  const amountValid = amount === '' || (Number.isFinite(amountNumber) && amountNumber > 0);
  const canSubmit = dayValid && amountValid && !configure.isPending;

  function submit() {
    if (!canSubmit) return;
    configure.mutate(
      {
        cadence,
        billingDayOfMonth: billingDay === '' ? undefined : dayNumber,
        amount: amount === '' ? undefined : Math.round(amountNumber * 100) / 100,
      },
      { onSuccess: onDone },
    );
  }

  return (
    <div className="grid gap-4 rounded-md border p-4 sm:grid-cols-3" data-testid="rent-schedule-form">
      <div className="space-y-2">
        <Label htmlFor={`rent-cadence-${leaseId}`}>{t('rent.cadenceLabel')}</Label>
        <select
          id={`rent-cadence-${leaseId}`}
          className={SELECT_CLASS}
          value={cadence}
          onChange={(e) => setCadence(e.target.value as RentCadence)}
        >
          {RENT_CADENCES.map((value) => (
            <option key={value} value={value}>
              {t(`rent.cadence.${value}`)}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor={`rent-day-${leaseId}`}>{t('rent.billingDayLabel')}</Label>
        <Input
          id={`rent-day-${leaseId}`}
          type="number"
          min={1}
          max={28}
          value={billingDay}
          placeholder={t('rent.billingDayPlaceholder')}
          onChange={(e) => setBillingDay(e.target.value)}
        />
        {!dayValid && (
          <p className="text-sm text-destructive" role="alert">
            {t('rent.billingDayInvalid')}
          </p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor={`rent-amount-${leaseId}`}>{t('rent.amountLabel')}</Label>
        <Input
          id={`rent-amount-${leaseId}`}
          inputMode="decimal"
          value={amount}
          placeholder={formatCurrency(defaultAmount)}
          onChange={(e) => setAmount(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          {t('rent.amountHint', { amount: formatCurrency(defaultAmount) })}
        </p>
        {!amountValid && (
          <p className="text-sm text-destructive" role="alert">
            {t('rent.amountInvalid')}
          </p>
        )}
      </div>
      <div className="flex gap-2 sm:col-span-3">
        <Button onClick={submit} disabled={!canSubmit}>
          {configure.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {ledger.schedule ? t('rent.saveChanges') : t('rent.createSchedule')}
        </Button>
        {onCancel && (
          <Button variant="outline" onClick={onCancel}>
            {t('rent.cancel')}
          </Button>
        )}
      </div>
    </div>
  );
}

const STATUS_VARIANT: Record<RentInstallment['status'], BadgeProps['variant']> = {
  Scheduled: 'outline',
  Processing: 'secondary',
  Paid: 'success',
  Failed: 'destructive',
  Cancelled: 'secondary',
};

function InstallmentsTable({ leaseId, ledger }: { leaseId: string; ledger: RentLedger }) {
  const { t } = useTranslation();
  const sendRequest = useSendRentPaymentRequest(leaseId);
  const [markPaidFor, setMarkPaidFor] = useState<RentInstallment | null>(null);
  const active = ledger.schedule?.isActive === true;

  if (ledger.installments.length === 0) {
    return (
      <p className="text-sm text-muted-foreground" data-testid="rent-no-installments">
        {t('rent.noInstallments')}
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm" data-testid="rent-installments">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            <th className="py-2 pr-3 font-medium">{t('rent.columns.period')}</th>
            <th className="py-2 pr-3 font-medium">{t('rent.columns.dueDate')}</th>
            <th className="py-2 pr-3 font-medium">{t('rent.columns.amount')}</th>
            <th className="py-2 pr-3 font-medium">{t('rent.columns.status')}</th>
            <th className="py-2 font-medium">{t('rent.columns.actions')}</th>
          </tr>
        </thead>
        <tbody>
          {ledger.installments.map((installment) => {
            const open = installment.status === 'Scheduled' || installment.status === 'Failed';
            return (
              <tr key={installment.id} className="border-b align-top" data-testid="rent-installment">
                <td className="py-2 pr-3">
                  {formatDate(installment.periodStart)} – {formatDate(installment.periodEnd)}
                </td>
                <td className="py-2 pr-3">{formatDate(installment.dueDate)}</td>
                <td className="py-2 pr-3">{formatCurrency(installment.amount, installment.currency)}</td>
                <td className="py-2 pr-3">
                  <div className="flex flex-wrap items-center gap-1">
                    <Badge variant={STATUS_VARIANT[installment.status]} data-testid="rent-installment-status">
                      {t(`rent.status.${installment.status}`)}
                    </Badge>
                    {installment.isOverdue && (
                      <Badge variant="warning" data-testid="rent-installment-overdue">
                        {t('rent.overdue')}
                      </Badge>
                    )}
                  </div>
                  <InstallmentDetail installment={installment} />
                </td>
                <td className="py-2">
                  {open && active && (
                    <div className="flex flex-wrap gap-2">
                      {ledger.onlinePaymentsAvailable && ledger.hasTenantEmail && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => sendRequest.mutate(installment.id)}
                          disabled={sendRequest.isPending}
                        >
                          {installment.paymentRequestedAt ? t('rent.resendLink') : t('rent.sendLink')}
                        </Button>
                      )}
                      <Button size="sm" variant="outline" onClick={() => setMarkPaidFor(installment)}>
                        {t('rent.markPaid')}
                      </Button>
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <MarkRentPaidDialog
        leaseId={leaseId}
        installment={markPaidFor}
        onOpenChange={(next) => {
          if (!next) setMarkPaidFor(null);
        }}
      />
    </div>
  );
}

function InstallmentDetail({ installment }: { installment: RentInstallment }) {
  const { t } = useTranslation();
  if (installment.status === 'Paid' && installment.paidOn) {
    return (
      <p className="mt-1 text-xs text-muted-foreground" data-testid="rent-installment-paid">
        {installment.paidVia === 'Offline'
          ? t('rent.paidOffline', { date: formatDate(installment.paidOn) })
          : t('rent.paidOnline', { date: formatDate(installment.paidOn) })}
        {installment.offlinePaymentNote ? ` · ${installment.offlinePaymentNote}` : ''}
      </p>
    );
  }
  if (installment.status === 'Failed') {
    return (
      <p className="mt-1 text-xs text-destructive">
        {installment.failureCode
          ? t('rent.failedWithCode', { code: installment.failureCode })
          : t('rent.failed')}
      </p>
    );
  }
  if (installment.status === 'Processing') {
    return <p className="mt-1 text-xs text-muted-foreground">{t('rent.processingHint')}</p>;
  }
  if (installment.status === 'Scheduled' && installment.paymentRequestedAt) {
    return (
      <p className="mt-1 text-xs text-muted-foreground">
        {t('rent.linkSent', { date: formatDate(romeDateOf(installment.paymentRequestedAt)) })}
      </p>
    );
  }
  return null;
}
