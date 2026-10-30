import { useTranslation } from 'react-i18next';
import { formatStayDate, romeDateOf } from '@/lib/stay-dates';
import { formatCurrency } from '@/lib/utils';
import type { GuestCancellationPreview } from '@/types';
import { chargesNothing } from '../cancellation-preview';

/**
 * The one highlighted block of the cancellation (DB-08b): what the guest gets back if they cancel today, in a sentence, and where the figure
 * comes from. Every amount and percent is the backend's (`GuestCancellationPreview`); the browser formats them and adds nothing up.
 */
export function RefundSummary({ preview }: { preview: GuestCancellationPreview }) {
  const { t, i18n } = useTranslation();
  const money = (amount: number) => formatCurrency(amount, preview.currency);
  const today = formatStayDate(romeDateOf(preview.generatedAt), i18n.language, { day: 'numeric', month: 'long' });

  const nothingToPay = chargesNothing(preview);
  const headline = nothingToPay
    ? preview.kind === 'withdrawRequest'
      ? t('guestCancellation.summary.withdraw')
      : t('guestCancellation.summary.noCharge')
    : preview.refundAmount > 0
      ? t('guestCancellation.summary.refund', { amount: money(preview.refundAmount) })
      : t('guestCancellation.summary.noRefund');

  return (
    // A ring and a tint, not a border: a global rule overrides the colors of `border-*` on the booking site.
    <div className="space-y-2 rounded-lg bg-primary/5 p-4 ring-1 ring-inset ring-primary/30" data-testid="guest-cancellation-summary">
      <p className="text-sm text-muted-foreground">{t('guestCancellation.summary.ifToday', { date: today })}</p>
      <p className="break-words text-xl font-semibold" data-testid="guest-cancellation-headline">
        {headline}
      </p>

      {preview.kind === 'deferredNoCharge' && (
        <p className="text-sm text-muted-foreground">{t('guestCancellation.summary.cardNotCharged')}</p>
      )}

      {!nothingToPay && (
        <div className="space-y-1 text-sm text-muted-foreground" data-testid="guest-cancellation-details">
          <p>{t('guestCancellation.summary.paid', { amount: money(preview.paidAmount) })}</p>
          {preview.alreadyRefundedAmount > 0 && (
            <p>{t('guestCancellation.summary.alreadyRefunded', { amount: money(preview.alreadyRefundedAmount) })}</p>
          )}
          {preview.refundPercent > 0 || preview.refundAmount > 0 ? (
            <p>{t('guestCancellation.summary.basis', { percent: preview.refundPercent })}</p>
          ) : null}
          {preview.retainedAmount > 0 && (
            <p data-testid="guest-cancellation-retained">
              {preview.policy
                ? t('guestCancellation.summary.retained', { amount: money(preview.retainedAmount), policy: preview.policy.name })
                : t('guestCancellation.summary.retainedNoPolicy', { amount: money(preview.retainedAmount) })}
            </p>
          )}
          {preview.refundAmount > 0 && <p>{t('guestCancellation.summary.timing')}</p>}
        </div>
      )}
    </div>
  );
}
