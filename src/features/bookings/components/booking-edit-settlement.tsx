import { useTranslation } from 'react-i18next';
import { RefundOutcomeMessage } from '@/features/payments/components/refund-outcome';
import { formatCurrency } from '@/lib/utils';
import type { BookingEditQuote, BookingEditSettlement as SavedSettlement } from '@/types';

interface BookingEditSettlementProps {
  quote: BookingEditQuote;
}

/**
 * The money consequence of an edit, read before it is saved (E08/F03/US02, NF-75): the price from and to, and what is done with the difference: the guest gets a
 * link to pay it, the saved card is charged, it goes back on the card, or nothing moves from here. A part of an overpayment that cannot go back online (paid in
 * cash or by transfer) is said as what the host gives back. Nothing was done yet: the host confirms or goes back to the form.
 */
export function BookingEditSettlement({ quote }: BookingEditSettlementProps) {
  const { t } = useTranslation();
  const money = (value: number) => formatCurrency(value, quote.currency);
  const priceChanges = quote.newTotal !== quote.previousTotal;
  const amount = money(quote.amount);

  const actionText =
    quote.action === 'paymentLink'
      ? t('booking.edit.settlement.preview.paymentLink', { amount })
      : quote.action === 'chargeSavedCard'
        ? t('booking.edit.settlement.preview.chargeSavedCard', { amount })
        : quote.action === 'refund'
          ? t('booking.edit.settlement.preview.refund', { amount })
          : t('booking.edit.settlement.preview.noMoney');

  return (
    <div className="space-y-2 text-sm" data-testid="booking-edit-settlement">
      <p data-testid="booking-edit-settlement-price">
        {priceChanges
          ? t('booking.edit.settlement.preview.priceChanges', { from: money(quote.previousTotal), to: money(quote.newTotal) })
          : t('booking.edit.settlement.preview.priceSame')}
      </p>
      {/* No money and the same price is the whole answer: "The price does not change". */}
      {(quote.action !== 'none' || priceChanges) && (
        <p data-testid="booking-edit-settlement-action" data-action={quote.action}>
          {actionText}
        </p>
      )}
      {quote.offlineRefundDue > 0 && (
        <p data-testid="booking-edit-settlement-offline">
          {t('booking.edit.settlement.preview.offlineRefundDue', { amount: money(quote.offlineRefundDue) })}
        </p>
      )}
    </div>
  );
}

interface BookingEditSettlementResultProps {
  settlement: SavedSettlement;
}

/**
 * What the money of a saved edit stands at (`settlement` of the answer of `PUT /bookings/:id`): a refund with the words of the refunds of a cancellation (confirmed by
 * Stripe, or waiting for it), a charge of the saved card, the link that was sent. A charge or a link that is not confirmed is said as not confirmed: a payment that did not
 * happen is never shown as done. Nothing for an edit that moved no money.
 */
export function BookingEditSettlementResult({ settlement }: BookingEditSettlementResultProps) {
  const { t } = useTranslation();
  const money = (value: number) => formatCurrency(value, settlement.currency);
  const done = settlement.state === 'done';
  const amount = money(settlement.amount);
  const tone = done ? 'text-sm text-green-700' : 'text-sm text-yellow-700';

  return (
    <div className="space-y-2" data-testid="booking-edit-settlement-result" data-action={settlement.action} data-state={settlement.state}>
      {settlement.action === 'refund' && (
        <RefundOutcomeMessage refund={{ amount: settlement.amount, status: done ? 'Succeeded' : 'Pending' }} currency={settlement.currency} />
      )}
      {settlement.action === 'chargeSavedCard' && (
        <p role="status" className={tone}>
          {done
            ? t('booking.edit.settlement.result.chargeSavedCard.done', { amount })
            : t('booking.edit.settlement.result.chargeSavedCard.pending', { amount })}
        </p>
      )}
      {settlement.action === 'paymentLink' && (
        <p role="status" className={tone}>
          {done
            ? t('booking.edit.settlement.result.paymentLink.done', { amount })
            : t('booking.edit.settlement.result.paymentLink.pending', { amount })}
        </p>
      )}
      {settlement.offlineRefundDue > 0 && (
        <p role="status" className="text-sm" data-testid="booking-edit-settlement-offline">
          {t('booking.edit.settlement.result.offlineRefundDue', { amount: money(settlement.offlineRefundDue) })}
        </p>
      )}
    </div>
  );
}
