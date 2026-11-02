import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ConfirmationDialog } from '@/components/shared/confirmation-dialog';
import { Button } from '@/components/ui/button';
import { PolicyTimeline } from '@/features/public-site/components/PolicyTimeline';
import { useOnlineStatus } from '@/hooks/use-online-status';
import { getProblemMessage, getRetryAfterSeconds, isTransientRequestError } from '@/lib/api-errors';
import { formatStayDate, romeDateOf } from '@/lib/stay-dates';
import { formatCurrency } from '@/lib/utils';
import { newIdempotencyKey, refundChangedPreview } from '@/queries/use-guest-cancellation';
import type { GuestCancelResult, GuestCancellationPreview } from '@/types';
import { chargesNothing } from '../cancellation-preview';
import { CancellationOutcome } from './cancellation-outcome';
import { RefundSummary } from './refund-summary';

/** What the guest confirmed: the refund they were shown and the key of this confirmation. */
interface CancellationRequest {
  expectedRefundAmount: number;
  idempotencyKey: string;
}

interface CancellationPanelProps {
  /** What cancelling does now (`cancellable` is true). */
  preview: GuestCancellationPreview;
  /** The answer of the cancellation the guest has just made on this page, if they have. */
  result: GuestCancelResult | null;
  /** Cancels for the refund the guest was shown. Resolves when the booking is cancelled; rejects with the error of the API. */
  onCancel: (request: CancellationRequest) => Promise<unknown>;
}

/**
 * The cancellation of a booking the guest can cancel (DB-08b), the same on the guest area and on the page of the host's link: the refund
 * they get if they cancel today as the one highlighted block, how the policy changes with the days, and the button that opens the
 * confirmation (which shows the same refund again). The guest confirms **the amount they saw**: if it changed meanwhile (a threshold of
 * the policy was crossed) nothing is cancelled, the new amount replaces the old and they are asked again. Once cancelled the panel is the
 * outcome of the refund, which takes the focus because the page changed under the person. One key per confirmation: a click that got no
 * answer is sent again with the same key, a new decision gets a new one.
 */
export function CancellationPanel({ preview, result, onCancel }: CancellationPanelProps) {
  const { t, i18n } = useTranslation();
  const online = useOnlineStatus();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [changedFrom, setChangedFrom] = useState<number | null>(null);
  const attemptKey = useRef<string | null>(null);
  const outcomeTitle = useRef<HTMLParagraphElement>(null);
  const focusOutcome = useRef(false);

  const money = (amount: number) => formatCurrency(amount, preview.currency);
  const withdraw = preview.kind === 'withdrawRequest';
  const outcome = preview.outcome ?? (result ? { refundAmount: result.refundAmount, refundStatus: result.refundStatus } : null);

  const problemText = (error: unknown): string => {
    const seconds = getRetryAfterSeconds(error);
    if (seconds !== undefined) {
      return t('publicBooking.guestBookings.rateLimited', { count: Math.max(1, Math.ceil(seconds / 60)) });
    }
    return getProblemMessage(error, t) ?? t('guestCancellation.problem.generic');
  };

  const confirm = async () => {
    const expectedRefundAmount = preview.refundAmount;
    const idempotencyKey = (attemptKey.current ??= newIdempotencyKey());
    setSubmitting(true);
    setProblem(null);
    setChangedFrom(null);
    try {
      await onCancel({ expectedRefundAmount, idempotencyKey });
      focusOutcome.current = true;
    } catch (error) {
      if (refundChangedPreview(error)) {
        // Nothing was cancelled and the new preview is already on screen: the guest decides again, with a new key.
        attemptKey.current = null;
        setChangedFrom(expectedRefundAmount);
      } else {
        // An answer ends this attempt; an answer that never came (no network, a 5xx) is retried with the same key.
        if (!isTransientRequestError(error)) attemptKey.current = null;
        setProblem(problemText(error));
      }
    } finally {
      setSubmitting(false);
    }
  };

  // The button that opened the dialog is gone once the booking is cancelled: when the dialog has closed and the outcome is there, the
  // focus goes to the outcome and not to the top of the page. Whichever of the two comes last (the answer or the closing) finds the other.
  const hasOutcome = outcome !== null;
  useEffect(() => {
    if (!hasOutcome || open || !focusOutcome.current) return;
    focusOutcome.current = false;
    outcomeTitle.current?.focus();
  }, [hasOutcome, open]);

  return (
    <div className="space-y-4" data-testid="guest-cancellation-panel">
      {outcome ? (
        <CancellationOutcome
          ref={outcomeTitle}
          refundAmount={outcome.refundAmount}
          refundStatus={outcome.refundStatus}
          currency={preview.currency}
        />
      ) : (
        <>
          {changedFrom !== null && (
            <p
              className="rounded-lg bg-[var(--cz-public-warn-soft)] p-3 text-sm text-[var(--cz-public-warn)]"
              role="status"
              data-testid="guest-cancellation-changed"
            >
              {t('guestCancellation.changed', { from: money(changedFrom), to: money(preview.refundAmount) })}
            </p>
          )}

          <RefundSummary preview={preview} />

          {!chargesNothing(preview) && (
            <div className="space-y-2" data-testid="guest-cancellation-policy">
              <p className="text-xs font-medium uppercase text-muted-foreground">{t('guestCancellation.policy.title')}</p>
              {preview.policy && <p className="text-sm font-medium">{preview.policy.name}</p>}
              <PolicyTimeline
                fullRefundUntil={preview.fullRefundUntil}
                partialRefundPercent={preview.partialRefundPercent}
                partialRefundUntil={preview.partialRefundUntil}
                today={romeDateOf(preview.generatedAt)}
                description={preview.policy?.description}
              />
            </div>
          )}

          {problem && (
            <p className="text-sm text-destructive" role="alert" data-testid="guest-cancellation-problem">
              {problem}
            </p>
          )}

          <div className="space-y-2">
            <Button
              type="button"
              variant="danger-outline"
              onClick={() => setOpen(true)}
              disabled={!online || submitting}
              className="w-full sm:w-auto"
              data-testid="guest-cancellation-open"
            >
              {withdraw ? t('guestCancellation.button.withdraw') : t('guestCancellation.button.cancel')}
            </Button>
            {!online && (
              <p className="text-sm text-muted-foreground" role="status" data-testid="guest-cancellation-offline">
                {t('guestCancellation.offline')}
              </p>
            )}
          </div>
        </>
      )}

      <ConfirmationDialog
        open={open}
        onOpenChange={setOpen}
        title={withdraw ? t('guestCancellation.dialog.withdrawTitle') : t('guestCancellation.dialog.cancelTitle')}
        description={t('guestCancellation.dialog.description', {
          property: preview.stay.propertyName,
          checkIn: formatStayDate(preview.stay.checkInDate, i18n.language, { day: 'numeric', month: 'long' }),
          checkOut: formatStayDate(preview.stay.checkOutDate, i18n.language),
        })}
        confirmLabel={withdraw ? t('guestCancellation.dialog.confirmWithdraw') : t('guestCancellation.dialog.confirmCancel')}
        cancelLabel={withdraw ? t('guestCancellation.dialog.keepWithdraw') : t('guestCancellation.dialog.keepCancel')}
        variant="destructive"
        isLoading={submitting}
        consequences={[withdraw ? t('guestCancellation.dialog.withdrawIrreversible') : t('guestCancellation.dialog.irreversible')]}
        onConfirm={confirm}
      >
        <RefundSummary preview={preview} />
      </ConfirmationDialog>
    </div>
  );
}

/**
 * The guest cannot cancel from where they are (DB-08b): a booking already cancelled shows what became of its refund; a stay that has
 * started sends them to the host (the guest area; the link of the host also works during the stay); a payment that is settling asks
 * them to wait; anything else says it plainly. Nothing to say renders nothing.
 */
export function CancellationClosed({ preview, hostEmail }: { preview: GuestCancellationPreview; hostEmail?: string | null }) {
  const { t } = useTranslation();

  if (preview.reason === 'already_cancelled') {
    return preview.outcome ? (
      <CancellationOutcome refundAmount={preview.outcome.refundAmount} refundStatus={preview.outcome.refundStatus} currency={preview.currency} />
    ) : null;
  }

  const text =
    preview.reason === 'stay_started'
      ? t('guestCancellation.notCancellable.stayStarted')
      : preview.reason === 'payment_in_progress'
        ? t('guestCancellation.notCancellable.paymentInProgress')
        : t('guestCancellation.notCancellable.generic');

  return (
    <div className="space-y-2" data-testid="guest-cancellation-closed">
      <p className="text-sm text-muted-foreground">{text}</p>
      {preview.reason === 'stay_started' && hostEmail && (
        <a href={`mailto:${hostEmail}`} className="inline-block text-sm font-medium text-primary underline-offset-4 hover:underline">
          {t('guestCancellation.notCancellable.writeToHost')}
        </a>
      )}
    </div>
  );
}
