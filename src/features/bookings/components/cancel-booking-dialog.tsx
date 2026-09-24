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
import { formatStayDate } from '@/lib/stay-dates';
import { getProblemMessage } from '@/lib/api-errors';
import { useBookingCancellationQuote, useCancelBooking } from '@/queries/use-bookings';
import { parseRefundAmount, toCents } from '@/features/payments/lib/refund-amount';
import { RefundOutcomeMessage } from '@/features/payments/components/refund-outcome';
import type { BookingCancellationQuote, CancelBookingResult } from '@/types';

interface CancelBookingDialogProps {
  bookingId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type RefundChoice = 'full' | 'partial';

/**
 * Host cancellation of a booking with its money on Stripe (BK-02, #51). When something was paid the
 * host chooses a full or partial refund, never below the minimum of the rule shown to the guest
 * (free cancellation deadline, property policy) and never above what was paid. After confirming,
 * each refund is shown as Stripe left it: confirmed, waiting for Stripe, or not done.
 */
export function CancelBookingDialog({ bookingId, open, onOpenChange }: CancelBookingDialogProps) {
  const { t } = useTranslation();
  const quote = useBookingCancellationQuote(bookingId, open);
  const cancel = useCancelBooking();
  const [choice, setChoice] = useState<RefundChoice>('full');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [amountError, setAmountError] = useState<string | null>(null);
  const [result, setResult] = useState<CancelBookingResult | null>(null);

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setChoice('full');
      setAmount('');
      setReason('');
      setAmountError(null);
      setResult(null);
      cancel.reset();
    }
    onOpenChange(next);
  };

  const handleSubmit = (event: FormEvent, data: BookingCancellationQuote) => {
    event.preventDefault();
    let refundAmount: number | undefined;

    if (data.requiresRefundDecision) {
      if (choice === 'full') {
        refundAmount = data.refundableAmount;
      } else {
        const parsed = parseRefundAmount(amount);
        if (parsed === null || Number.isNaN(parsed)) {
          setAmountError(t('booking.cancel.errors.amountInvalid'));
          return;
        }
        if (toCents(parsed) < toCents(data.minimumRefundAmount) || toCents(parsed) > toCents(data.refundableAmount)) {
          setAmountError(
            t('booking.cancel.errors.amountOutOfRange', {
              min: formatCurrency(data.minimumRefundAmount, data.currency),
              max: formatCurrency(data.refundableAmount, data.currency),
            }),
          );
          return;
        }
        refundAmount = parsed;
      }
    }

    setAmountError(null);
    cancel.mutate(
      { id: bookingId, data: { refundAmount, reason: reason.trim() || undefined } },
      { onSuccess: setResult },
    );
  };

  const data = quote.data;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('booking.cancel.title')}</DialogTitle>
          <DialogDescription>{t('booking.cancel.description')}</DialogDescription>
        </DialogHeader>

        {quote.isLoading && <p className="py-4 text-sm text-muted-foreground">{t('booking.cancel.loading')}</p>}

        {quote.isError && (
          <p role="alert" className="py-4 text-sm text-destructive">
            {getProblemMessage(quote.error, t) ?? t('booking.cancel.loadError')}
          </p>
        )}

        {result && (
          <div className="space-y-3 py-2">
            <p role="status" className="font-medium">{t('booking.cancel.result.cancelled')}</p>
            {result.canceledIntents > 0 && (
              <p className="text-sm text-muted-foreground">{t('booking.cancel.result.intentsCanceled')}</p>
            )}
            {result.refunds.map((refund) => (
              <RefundOutcomeMessage key={refund.id} refund={refund} currency={data?.currency} />
            ))}
            {result.refunds.length === 0 && (
              <p className="text-sm text-muted-foreground">{t('booking.cancel.result.noRefund')}</p>
            )}
            <DialogFooter>
              <Button type="button" onClick={() => handleOpenChange(false)}>
                {t('booking.cancel.close')}
              </Button>
            </DialogFooter>
          </div>
        )}

        {data && !result && !data.cancellable && (
          <p className="py-4 text-sm text-muted-foreground">{t('booking.cancel.notCancellable')}</p>
        )}

        {data && !result && data.cancellable && (
          <form onSubmit={(event) => handleSubmit(event, data)} noValidate>
            <div className="space-y-4 py-2 text-sm">
              {data.hasUncollectedIntent && <p>{t('booking.cancel.uncollectedIntent')}</p>}

              {data.offlinePaidAmount > 0 && (
                <p>{t('booking.cancel.offlinePaid', { amount: formatCurrency(data.offlinePaidAmount, data.currency) })}</p>
              )}

              {data.requiresRefundDecision && (
                <RefundDecision
                  data={data}
                  choice={choice}
                  onChoiceChange={(next) => {
                    setChoice(next);
                    setAmountError(null);
                  }}
                  amount={amount}
                  onAmountChange={setAmount}
                  amountError={amountError}
                />
              )}

              <div className="space-y-2">
                <Label htmlFor="cancel-reason">{t('booking.cancel.reason')}</Label>
                <Textarea
                  id="cancel-reason"
                  value={reason}
                  maxLength={500}
                  onChange={(e) => setReason(e.target.value)}
                  rows={2}
                />
                <p className="text-xs text-muted-foreground">{t('booking.cancel.guestNotified')}</p>
              </div>

              {cancel.isError && (
                <p role="alert" className="text-destructive">
                  {getProblemMessage(cancel.error, t) ?? t('booking.cancel.failed')}
                </p>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={cancel.isPending}>
                {t('booking.cancel.keep')}
              </Button>
              <Button type="submit" variant="destructive" disabled={cancel.isPending}>
                {cancel.isPending ? t('booking.cancel.submitting') : t('booking.cancel.confirm')}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

interface RefundDecisionProps {
  data: BookingCancellationQuote;
  choice: RefundChoice;
  onChoiceChange: (choice: RefundChoice) => void;
  amount: string;
  onAmountChange: (amount: string) => void;
  amountError: string | null;
}

function RefundDecision({ data, choice, onChoiceChange, amount, onAmountChange, amountError }: RefundDecisionProps) {
  const { t, i18n } = useTranslation();
  const money = (value: number) => formatCurrency(value, data.currency);
  // A rule that grants everything leaves nothing to choose.
  const partialAllowed = toCents(data.minimumRefundAmount) < toCents(data.refundableAmount);

  const ruleText =
    data.rule === 'FreeCancellationDeadline'
      ? t('booking.cancel.rule.freeCancellation', {
          date: formatStayDate((data.freeCancellationUntil ?? '').slice(0, 10), i18n.language),
        })
      : data.rule === 'PropertyCancellationPolicy'
        ? t('booking.cancel.rule.policy', {
            name: data.cancellationPolicyName ?? '',
            amount: money(data.minimumRefundAmount),
          })
        : t('booking.cancel.rule.none', { amount: money(data.refundableAmount) });

  return (
    <div className="space-y-3">
      <dl className="rounded-lg bg-muted p-4 space-y-2">
        <div className="flex justify-between">
          <dt className="text-muted-foreground">{t('booking.cancel.paid')}</dt>
          <dd className="font-semibold">{money(data.paidAmount)}</dd>
        </div>
        {data.refundedAmount > 0 && (
          <div className="flex justify-between">
            <dt className="text-muted-foreground">{t('booking.cancel.refunded')}</dt>
            <dd>-{money(data.refundedAmount)}</dd>
          </div>
        )}
        {data.pendingRefundAmount > 0 && (
          <div className="flex justify-between">
            <dt className="text-muted-foreground">{t('booking.cancel.inProgress')}</dt>
            <dd>-{money(data.pendingRefundAmount)}</dd>
          </div>
        )}
        <div className="flex justify-between border-t pt-2">
          <dt className="text-muted-foreground">{t('booking.cancel.refundable')}</dt>
          <dd className="font-bold">{money(data.refundableAmount)}</dd>
        </div>
      </dl>

      <p>{ruleText}</p>

      <fieldset className="space-y-2">
        <legend className="sr-only">{t('booking.cancel.refundChoice')}</legend>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name="refund-choice"
            value="full"
            checked={choice === 'full'}
            onChange={() => onChoiceChange('full')}
          />
          {t('booking.cancel.refundFull', { amount: money(data.refundableAmount) })}
        </label>
        {partialAllowed && (
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="refund-choice"
              value="partial"
              checked={choice === 'partial'}
              onChange={() => onChoiceChange('partial')}
            />
            {t('booking.cancel.refundPartial')}
          </label>
        )}
      </fieldset>

      {choice === 'partial' && partialAllowed && (
        <div className="space-y-2">
          <Label htmlFor="cancel-refund-amount">{t('booking.cancel.partialLabel')}</Label>
          <Input
            id="cancel-refund-amount"
            inputMode="decimal"
            value={amount}
            onChange={(e) => onAmountChange(e.target.value)}
            aria-invalid={amountError ? true : undefined}
            aria-describedby="cancel-refund-amount-hint"
          />
          <p id="cancel-refund-amount-hint" className="text-xs text-muted-foreground">
            {t('booking.cancel.partialHint', {
              min: money(data.minimumRefundAmount),
              max: money(data.refundableAmount),
            })}
          </p>
          <FormFieldError message={amountError} />
        </div>
      )}
    </div>
  );
}
