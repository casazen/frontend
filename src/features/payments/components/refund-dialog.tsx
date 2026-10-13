import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { FormFieldError } from '@/components/shared/form-field-error';
import { formatCurrency } from '@/lib/utils';
import { getProblemMessage } from '@/lib/api-errors';
import { usePaymentRefunds, useRefundPayment } from '@/queries/use-payments';
import { parseRefundAmount, toCents } from '../lib/refund-amount';
import { RefundOutcomeMessage } from './refund-outcome';
import type { Payment, PaymentRefund } from '@/types';

interface RefundDialogProps {
  payment: Payment;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Refund of a payment on Stripe (BK-02). The amounts come from the server (confirmed refunds and
 * refunds still waiting for Stripe); after sending, the dialog shows what Stripe answered:
 * confirmed, waiting for confirmation, or not done. It never says "refunded" before Stripe does.
 */
export function RefundDialog({ payment, open, onOpenChange }: RefundDialogProps) {
  const { t } = useTranslation();
  const refunds = usePaymentRefunds(payment.id, open);
  const refund = useRefundPayment();
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [amountError, setAmountError] = useState<string | null>(null);
  const [result, setResult] = useState<PaymentRefund | null>(null);

  const currency = payment.currency || 'EUR';
  const summary = refunds.data;
  const refundable = summary?.refundableAmount ?? 0;

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setAmount('');
      setReason('');
      setAmountError(null);
      setResult(null);
      refund.reset();
    }
    onOpenChange(next);
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const parsed = parseRefundAmount(amount);
    if (parsed !== null && (Number.isNaN(parsed) || parsed <= 0)) {
      setAmountError(t('payment.refund.errors.amountInvalid'));
      return;
    }
    if (parsed !== null && toCents(parsed) > toCents(refundable)) {
      setAmountError(t('payment.refund.errors.amountTooHigh', { amount: formatCurrency(refundable, currency) }));
      return;
    }

    setAmountError(null);
    refund.mutate(
      { id: payment.id, data: { amount: parsed ?? undefined, reason: reason.trim() || undefined } },
      { onSuccess: setResult },
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('payment.refund.title')}</DialogTitle>
          <DialogDescription>{t('payment.refund.description')}</DialogDescription>
        </DialogHeader>

        {refunds.isLoading && <p className="py-4 text-sm text-muted-foreground">{t('payment.refund.loading')}</p>}

        {refunds.isError && (
          <p role="alert" className="py-4 text-sm text-destructive">
            {getProblemMessage(refunds.error, t) ?? t('payment.refund.loadError')}
          </p>
        )}

        {result && (
          <div className="space-y-4 py-2">
            <RefundOutcomeMessage refund={result} currency={currency} />
            <DialogFooter>
              <Button type="button" onClick={() => handleOpenChange(false)}>
                {t('payment.refund.close')}
              </Button>
            </DialogFooter>
          </div>
        )}

        {summary && !result && !summary.refundableOnline && (
          <p className="py-4 text-sm text-muted-foreground">{t('payment.refund.notOnline')}</p>
        )}

        {summary && !result && summary.refundableOnline && refundable <= 0 && (
          <p className="py-4 text-sm text-muted-foreground">{t('payment.refund.nothingToRefund')}</p>
        )}

        {summary && !result && summary.refundableOnline && refundable > 0 && (
          <form onSubmit={handleSubmit} noValidate>
            <div className="space-y-4 py-2">
              <dl className="rounded-lg bg-muted p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">{t('payment.refund.originalAmount')}</dt>
                  <dd className="font-semibold">{formatCurrency(summary.paidAmount, currency)}</dd>
                </div>
                {summary.refundedAmount > 0 && (
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">{t('payment.refund.alreadyRefunded')}</dt>
                    <dd>-{formatCurrency(summary.refundedAmount, currency)}</dd>
                  </div>
                )}
                {summary.pendingRefundAmount > 0 && (
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">{t('payment.refund.inProgress')}</dt>
                    <dd>-{formatCurrency(summary.pendingRefundAmount, currency)}</dd>
                  </div>
                )}
                <div className="flex justify-between border-t pt-2">
                  <dt className="text-muted-foreground">{t('payment.refund.refundableAmount')}</dt>
                  <dd className="font-bold">{formatCurrency(refundable, currency)}</dd>
                </div>
              </dl>

              <div className="space-y-2">
                <Label htmlFor="refund-amount">{t('payment.refund.amountLabel')}</Label>
                <Input
                  id="refund-amount"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder={refundable.toFixed(2)}
                  aria-invalid={amountError ? true : undefined}
                  aria-describedby="refund-amount-hint"
                />
                <p id="refund-amount-hint" className="text-xs text-muted-foreground">
                  {t('payment.refund.amountHint', { amount: formatCurrency(refundable, currency) })}
                </p>
                <FormFieldError message={amountError} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="refund-reason">{t('payment.refund.reason')}</Label>
                <Textarea
                  id="refund-reason"
                  value={reason}
                  maxLength={500}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={t('payment.refund.reasonPlaceholder')}
                  rows={3}
                />
              </div>

              {refund.isError && (
                <p role="alert" className="text-sm text-destructive">
                  {getProblemMessage(refund.error, t) ?? t('payment.refund.failedGeneric')}
                </p>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={refund.isPending}>
                {t('payment.refund.cancel')}
              </Button>
              <Button type="submit" variant="destructive" disabled={refund.isPending}>
                {refund.isPending ? t('payment.refund.submitting') : t('payment.refund.confirm')}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
