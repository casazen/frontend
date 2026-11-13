import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Calendar, Download } from 'lucide-react';
import { ConfirmationDialog } from '@/components/shared/confirmation-dialog';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useOwnerFormat } from '@/features/owner-accounting/use-owner-format';
import { useExactMoney } from '@/hooks/use-exact-money';
import { F24_CURRENCY, failureMessage } from '@/lib/agency-finance';
import { useDownloadF24, useRecordPayment } from '@/queries/withholding';
import type { TaxF24Record } from '@/types';

interface F24CardProps {
  /** The F24 of the month as the server has it (the amount, the due date and the payment are the server's). */
  record: TaxF24Record;
}

/**
 * The F24 of a month (ADR-018): the data to fill the form with as the server stored it, its PDF, and the registration of its payment. It owns both of its
 * requests, so while either is on its way every button of the card waits. Registering the payment cannot be undone and it is the administrator's word (nothing here
 * knows whether the bank or the Revenue Agency has it), so it asks to be confirmed with the F24, the amount and the day, and is told as «registered by the
 * administrator», never as a payment that was made. An F24 whose payment is not registered says so, and says when it is overdue.
 */
export function F24Card({ record }: F24CardProps) {
  const { t } = useTranslation();
  const { date, dateTime, month } = useOwnerFormat();
  const money = useExactMoney();
  const download = useDownloadF24();
  const recordPayment = useRecordPayment();
  const [paymentDate, setPaymentDate] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  // A request is on its way: the state of the mutation says it a moment later than the click, so a second one in between is stopped here.
  const sending = useRef(false);

  const busy = download.isPending || recordPayment.isPending;
  const period = month(record.referenceYear, record.referenceMonth);
  const amount = money(record.totalAmount, F24_CURRENCY);
  const dueDate = date(record.dueDate.slice(0, 10));
  const paid = record.paidAt !== null;

  const onDownload = async () => {
    if (busy || sending.current) return;
    sending.current = true;
    setFailure(null);
    try {
      await download.mutateAsync({
        month: record.referenceMonth,
        year: record.referenceYear,
        fallbackName: `f24-${record.referenceYear}-${String(record.referenceMonth).padStart(2, '0')}.pdf`,
      });
    } catch (error) {
      setFailure(failureMessage(error, t, t('withholding.f24.downloadError'), t('withholding.f24.notFound')));
    } finally {
      sending.current = false;
      download.reset();
    }
  };

  /** The payment is registered once the person has confirmed it. The server's answer decides: a refusal is told here and nothing is shown as paid. */
  const onRegister = async () => {
    if (busy || sending.current || !paymentDate) return;
    sending.current = true;
    setFailure(null);
    try {
      await recordPayment.mutateAsync({ f24Id: record.id, paidAt: new Date(paymentDate).toISOString() });
      setPaymentDate('');
    } catch (error) {
      setFailure(failureMessage(error, t, t('withholding.payment.recordError'), t('withholding.f24.notFound')));
    } finally {
      sending.current = false;
      recordPayment.reset();
    }
  };

  const dismissConfirmation = (open: boolean) => {
    // The request is on its way: the dialog stays until the server has answered.
    if (!open && !busy) setConfirming(false);
  };

  return (
    <Card data-testid="f24-card">
      <CardHeader>
        <CardTitle>{t('withholding.f24.title')}</CardTitle>
        <CardDescription>{t('withholding.f24.description', { period })}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {failure && (
          <Alert variant="danger" data-testid="f24-failure">
            {failure}
          </Alert>
        )}

        <dl className="grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-sm text-muted-foreground">{t('withholding.f24.taxCode')}</dt>
            <dd className="font-mono font-semibold text-lg" data-testid="f24-tax-code">{record.taxCode}</dd>
          </div>

          <div>
            <dt className="text-sm text-muted-foreground">{t('withholding.f24.reference')}</dt>
            <dd className="font-semibold text-lg">{period}</dd>
          </div>

          <div>
            <dt className="text-sm text-muted-foreground">{t('withholding.f24.totalAmount')}</dt>
            <dd className="font-semibold text-lg" data-testid="f24-amount">{amount}</dd>
          </div>

          <div>
            <dt className="text-sm text-muted-foreground">{t('withholding.dueDate')}</dt>
            <dd className="font-semibold text-lg" data-testid="f24-due-date">{dueDate}</dd>
          </div>
        </dl>

        {paid ? (
          <Alert variant="success" data-testid="f24-paid">
            {t('withholding.f24.paidRegistered', { date: dateTime(record.paidAt) })}
          </Alert>
        ) : (
          <Alert variant={record.isOverdue ? 'danger' : 'info'} data-testid="f24-unpaid">
            {record.isOverdue ? t('withholding.f24.overdueUnpaid', { date: dueDate }) : t('withholding.f24.unpaid')}
          </Alert>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={() => void onDownload()} disabled={busy} data-testid="f24-download">
            <Download className="mr-2 h-4 w-4" />
            {t('withholding.f24.download')}
          </Button>
          <Button asChild variant="ghost">
            <Link to={`/app/account/owner-close?period=${record.referenceYear}-${String(record.referenceMonth).padStart(2, '0')}`}>
              {t('withholding.f24.filingLink')}
            </Link>
          </Button>
        </div>

        {!paid && (
          <div className="space-y-3 border-t pt-4" data-testid="f24-payment">
            <div>
              <h3 className="font-semibold">{t('withholding.payment.title')}</h3>
              <p className="text-sm text-muted-foreground">{t('withholding.payment.description')}</p>
            </div>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
              <div className="flex-1">
                <Label htmlFor="paymentDate">{t('withholding.payment.date')}</Label>
                <div className="relative mt-2">
                  <Input
                    id="paymentDate"
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    disabled={busy}
                    className="pl-10"
                  />
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                </div>
              </div>
              <Button onClick={() => setConfirming(true)} disabled={!paymentDate || busy} data-testid="f24-record-payment">
                {t('withholding.payment.record')}
              </Button>
            </div>
          </div>
        )}
      </CardContent>

      <ConfirmationDialog
        open={confirming}
        onOpenChange={dismissConfirmation}
        title={t('withholding.payment.confirmTitle')}
        description={t('withholding.payment.confirmDescription', { period, amount, date: paymentDate ? date(paymentDate) : '' })}
        consequences={[t('withholding.payment.consequenceWord'), t('withholding.payment.consequenceFinal')]}
        confirmLabel={t('withholding.payment.record')}
        isLoading={busy}
        onConfirm={onRegister}
      />
    </Card>
  );
}
