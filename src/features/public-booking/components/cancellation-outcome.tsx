import { forwardRef } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2 } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import type { GuestRefundStatus } from '@/types';

interface CancellationOutcomeProps {
  refundAmount: number;
  refundStatus: GuestRefundStatus;
  currency: string;
}

/**
 * The booking is cancelled (DB-08b): what happened to the refund. It is «in corso» until the payment provider confirms it, never «fatto»
 * before; its first line takes the focus when the guest has just cancelled (the page changed under them), and is announced politely.
 * The first line is not a heading: this block sits under the heading of the page or of the section, whatever its level.
 */
export const CancellationOutcome = forwardRef<HTMLParagraphElement, CancellationOutcomeProps>(function CancellationOutcome(
  { refundAmount, refundStatus, currency },
  titleRef,
) {
  const { t } = useTranslation();
  const amount = formatCurrency(refundAmount, currency);
  const detail =
    refundStatus === 'confirmed'
      ? t('guestCancellation.outcome.confirmed', { amount })
      : refundStatus === 'failed'
        ? t('guestCancellation.outcome.failed', { amount })
        : refundStatus === 'pending'
          ? t('guestCancellation.outcome.pending', { amount })
          : t('guestCancellation.outcome.none');

  return (
    <div className="flex gap-3" role="status" data-testid="guest-cancellation-outcome">
      <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-[var(--cz-public-ok)]" aria-hidden="true" />
      <div className="min-w-0 space-y-1">
        <p ref={titleRef} tabIndex={-1} className="font-semibold outline-none" data-testid="guest-cancellation-outcome-title">
          {t('guestCancellation.outcome.title')}
        </p>
        <p className="break-words text-sm text-muted-foreground" data-testid="guest-cancellation-outcome-detail">
          {detail}
        </p>
      </div>
    </div>
  );
});
