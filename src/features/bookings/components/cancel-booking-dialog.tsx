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
import { useBooking, useBookingCancellationQuote, useCancelBooking, useRetryOctorateSync } from '@/queries/use-bookings';
import { parseRefundAmount, toCents } from '@/features/payments/lib/refund-amount';
import { RefundOutcomeMessage } from '@/features/payments/components/refund-outcome';
import type { Booking, BookingCancellationQuote, BookingChangeOptions, CancelBookingResult } from '@/types';
import { channelGuidanceOf, channelRefusalOf } from '../lib/booking-change';
import { useSyncWatch } from '../lib/use-sync-watch';
import { BookingCancelSync } from './booking-cancel-sync';
import { OtaChangeGuidance } from './ota-change-guidance';

interface CancelBookingDialogProps {
  bookingId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type RefundChoice = 'full' | 'partial';

/**
 * Host cancellation of a booking (BK-02, #51, E08/F03/US02, NF-76). The booking is read when the dialog opens, because what the host may do depends on it: a booking CasaZen holds
 * the money of is cancelled with its refunds on Stripe (`MoneyCancel`), a booking that came from a channel is cancelled by asking the channel manager (`ChannelCancel`). The
 * body lives only while the dialog is open, so everything it holds (the choice, the note, the outcome) is gone when it closes.
 */
export function CancelBookingDialog({ bookingId, open, onOpenChange }: CancelBookingDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">{open && bookingId !== '' ? <CancelBookingBody bookingId={bookingId} onClose={() => onOpenChange(false)} /> : null}</DialogContent>
    </Dialog>
  );
}

function CancelBookingBody({ bookingId, onClose }: { bookingId: string; onClose: () => void }) {
  const { t } = useTranslation();
  const watch = useSyncWatch();
  // The booking says whether it is one of a channel (`changeOptions`) and whether it is mirrored on the channel manager (`octorateSync`); the line of the channel manager is read
  // again while its answer is to come. A booking that cannot be read is taken for one CasaZen holds: the server decides the path anyway.
  const booking = useBooking(bookingId, { fresh: true, refetchInterval: (current) => watch.interval(current?.octorateSync) });
  const options = booking.data?.changeOptions;
  const isChannel = !!options?.channel;

  return (
    <>
      <DialogHeader>
        <DialogTitle>{isChannel ? t('booking.cancel.channel.title') : t('booking.cancel.title')}</DialogTitle>
        <DialogDescription>{isChannel ? t('booking.cancel.channel.description') : t('booking.cancel.description')}</DialogDescription>
      </DialogHeader>

      {booking.isPending ? (
        <p className="py-4 text-sm text-muted-foreground">{t('booking.cancel.loading')}</p>
      ) : isChannel && options ? (
        <ChannelCancel bookingId={bookingId} options={options} onClose={onClose} />
      ) : (
        <MoneyCancel bookingId={bookingId} booking={booking.data} watch={watch} onClose={onClose} />
      )}
    </>
  );
}

interface ChannelCancelProps {
  bookingId: string;
  options: BookingChangeOptions;
  onClose: () => void;
}

/**
 * The cancellation of a booking that came from a channel (NF-76): the host asks the channel manager, which asks the channel, and the booking is cancelled in CasaZen only when it
 * confirmed (the API answers 200 only then). No money moves from here and there is no refund to choose. Where the channel is closed there is no button, only the sentence that says
 * how to ask the guest or the channel; a refusal (the channel is closed, the channel manager refused, it did not answer) leaves the booking as it was and says so, with that sentence.
 */
function ChannelCancel({ bookingId, options, onClose }: ChannelCancelProps) {
  const { t } = useTranslation();
  const cancel = useCancelBooking();
  const [reason, setReason] = useState('');
  const [done, setDone] = useState(false);
  const refusal = cancel.isError ? channelRefusalOf(cancel.error) : null;
  const closed = channelGuidanceOf(options, 'cancel');

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    // A dialog rendered inside a form must not submit it (the portal passes the event on).
    event.stopPropagation();
    cancel.mutate({ id: bookingId, data: { reason: reason.trim() || undefined } }, { onSuccess: () => setDone(true) });
  };

  if (done) {
    return (
      <div className="space-y-3 py-2">
        <p role="status" className="font-medium" data-testid="cancel-channel-done">
          {t('booking.cancel.result.cancelled')}
        </p>
        <p className="text-sm text-muted-foreground">{t('booking.cancel.channel.confirmed')}</p>
        <DialogFooter>
          <Button type="button" onClick={onClose}>
            {t('booking.cancel.close')}
          </Button>
        </DialogFooter>
      </div>
    );
  }

  // Closed for the cancellation (or not cancellable at all): no action, only what to do.
  if (!options.canCancel) {
    return (
      <div className="space-y-3 py-2">
        {closed ? (
          <OtaChangeGuidance action="cancel" channel={closed.channel} />
        ) : (
          <p className="text-sm text-muted-foreground">{t('booking.cancel.notCancellable')}</p>
        )}
        <DialogFooter>
          <Button type="button" onClick={onClose}>
            {t('booking.cancel.close')}
          </Button>
        </DialogFooter>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="space-y-4 py-2 text-sm">
        <p>{t('booking.cancel.channel.noMoney')}</p>

        <div className="space-y-2">
          <Label htmlFor="cancel-reason">{t('booking.cancel.reason')}</Label>
          <Textarea id="cancel-reason" value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} rows={2} />
        </div>

        {cancel.isError && (
          <div role="alert" className="space-y-2 text-destructive" data-testid="cancel-channel-error" data-code={refusal?.code}>
            {refusal ? (
              <>
                <p className="font-medium">{t('booking.cancel.channel.refused')}</p>
                <p>{getProblemMessage(cancel.error, t) ?? t('booking.cancel.failed')}</p>
                <OtaChangeGuidance action="cancel" channel={refusal.channel ?? options.channel} className="text-foreground/70" />
              </>
            ) : (
              <p>{getProblemMessage(cancel.error, t) ?? t('booking.cancel.failed')}</p>
            )}
          </div>
        )}
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose} disabled={cancel.isPending}>
          {t('booking.cancel.keep')}
        </Button>
        <Button type="submit" variant="destructive" disabled={cancel.isPending} data-testid="cancel-channel-confirm">
          {cancel.isPending ? t('booking.cancel.channel.submitting') : t('booking.cancel.channel.confirm')}
        </Button>
      </DialogFooter>
    </form>
  );
}

interface MoneyCancelProps {
  bookingId: string;
  /** The booking as it was read; `undefined` when it could not be. */
  booking: Booking | undefined;
  watch: ReturnType<typeof useSyncWatch>;
  onClose: () => void;
}

/**
 * Host cancellation of a booking with its money on Stripe (BK-02, #51). When something was paid the host chooses a full or partial refund, never below the minimum of the rule shown to
 * the guest (free cancellation deadline, property policy) and never above what was paid. After confirming, each refund is shown as Stripe left it: confirmed, waiting for Stripe, or
 * not done; and, for a booking that is mirrored on the channel manager, one line for it (E08/F03/US02, NF-76): being sent, cancelled there too, or failed with "Retry now". The
 * cancellation is made in CasaZen first: the refunds never wait for that line.
 */
function MoneyCancel({ bookingId, booking, watch, onClose }: MoneyCancelProps) {
  const { t } = useTranslation();
  const quote = useBookingCancellationQuote(bookingId, true);
  const cancel = useCancelBooking();
  const retry = useRetryOctorateSync();
  const [choice, setChoice] = useState<RefundChoice>('full');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [amountError, setAmountError] = useState<string | null>(null);
  const [result, setResult] = useState<CancelBookingResult | null>(null);
  const [retryError, setRetryError] = useState<string | null>(null);
  const mirrored = booking?.octorateSync != null;
  // The retry and the cancellation are one card: neither can be started while the other is under way.
  const busy = cancel.isPending || retry.isPending;

  const askAgain = () => {
    setRetryError(null);
    retry.mutate(
      { id: bookingId },
      {
        onSuccess: () => watch.ask(),
        onError: (failure) => setRetryError(getProblemMessage(failure, t) ?? t('booking.cancel.sync.retryFailed')),
      },
    );
  };

  const handleSubmit = (event: FormEvent, data: BookingCancellationQuote) => {
    event.preventDefault();
    // A dialog rendered inside a form must not submit it (the portal passes the event on).
    event.stopPropagation();
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
      {
        onSuccess: (cancelled) => {
          setResult(cancelled);
          // The cancellation is sent to the channel manager after it is made: the page asks for its answer.
          if (mirrored) watch.ask();
        },
      },
    );
  };

  const data = quote.data;

  return (
    <>
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
          {booking && mirrored && <BookingCancelSync booking={booking} busy={busy} retryError={retryError} onRetry={askAgain} />}
          <DialogFooter>
            <Button type="button" onClick={onClose} disabled={retry.isPending}>
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

            {/* The channel manager is told after the cancellation, and the refunds above do not wait for it. */}
            {mirrored && (
              <p className="text-muted-foreground" data-testid="cancel-sync-note">
                {t('booking.cancel.sync.willUpdate')}
              </p>
            )}

            {cancel.isError && (
              <p role="alert" className="text-destructive">
                {getProblemMessage(cancel.error, t) ?? t('booking.cancel.failed')}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={cancel.isPending}>
              {t('booking.cancel.keep')}
            </Button>
            <Button type="submit" variant="destructive" disabled={cancel.isPending}>
              {cancel.isPending ? t('booking.cancel.submitting') : t('booking.cancel.confirm')}
            </Button>
          </DialogFooter>
        </form>
      )}
    </>
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
