import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { PlainSection } from '@/components/shared/calm';
import { RecordPaymentDialog } from '@/features/payments/components/record-payment-dialog';
import { balanceOf, canRecordPayment } from '@/features/payments/lib/record-payment';
import { useWorkspace } from '@/hooks/use-workspace';
import { formatCurrency } from '@/lib/utils';
import type { Booking, BookingAmountSources } from '@/types';
import { bookingPriceBreakdown } from '../lib/booking-price';
import { Amount, AmountSourceLine } from './booking-facts';
import { BookingOtaAmounts } from './booking-ota-amounts';

/**
 * The tab Pagamento: the price as the booking recorded it: lodging (per night: base price without cleaning, divided by the nights;
 * tourist tax and cleaning excluded, A2-30), cleaning fee, tourist tax, total; and under it what came in (SR-05c): the state of the
 * payment and, for who may read payments, the amount collected. The detail of the booking carries both; the booking an action
 * answers with does not (the page reads the detail again at once), and whoever may not read payments gets the state without the amount.
 *
 * Each of those figures says where it comes from when the API says it (`amountSources`, NF-77): Stripe for a booking made on the
 * site, the host's own entry for a payment recorded by hand. A channel booking has its own section under this one, "Importi del
 * canale", where every figure carries its source, so the summary does not tag the same numbers twice.
 */
export function BookingPaymentTab({ booking }: { booking: Booking }) {
  const { t } = useTranslation();
  const breakdown = bookingPriceBreakdown(booking);
  const money = (value: number) => formatCurrency(value, booking.currency);
  const sources: BookingAmountSources = booking.otaAmounts ? {} : (booking.amountSources ?? {});
  const collected = typeof booking.paidAmount === 'number' && booking.paidAmount > 0 ? booking.paidAmount : null;
  const { hasPermission } = useWorkspace();
  const [recordOpen, setRecordOpen] = useState(false);
  // What is left to collect is known to who may read the payments; "Registra incasso" (SR-06b) is for who may write them, on a
  // booking the host collects itself that still has something to collect.
  const balance = balanceOf(booking);
  const canRecord =
    Boolean(booking.paymentState) && canRecordPayment(booking) && (balance === null || balance > 0) && hasPermission('short-rent', 'payment.write');

  return (
    <div className="space-y-8">
      <PlainSection title={t('booking.detailPage.paymentSummaryTitle')}>
        <div className="max-w-xl space-y-3">
          {breakdown ? (
            <dl className="space-y-2">
              <Amount label={t('booking.detailPage.lodgingPerNight', { count: breakdown.nights, perNight: money(breakdown.perNight) })} labelTestId="booking-price-per-night">
                {money(breakdown.lodging)}
              </Amount>
              {breakdown.cleaningFee > 0 ? <Amount label={t('booking.detailPage.cleaningFee')}>{money(breakdown.cleaningFee)}</Amount> : null}
              {breakdown.touristTax > 0 ? <Amount label={t('booking.detailPage.touristTax')}>{money(breakdown.touristTax)}</Amount> : null}
            </dl>
          ) : (
            <p className="text-sm text-foreground/70" data-testid="booking-price-no-breakdown">
              {t('booking.detailPage.noPriceBreakdown')}
            </p>
          )}

          <dl className="flex min-w-0 items-baseline justify-between gap-4 pt-1">
            <dt className="font-semibold">{t('booking.detailPage.total')}</dt>
            <dd className="text-2xl font-bold tabular-nums" data-testid="booking-price-total">
              {money(booking.totalPrice)}
            </dd>
          </dl>
          <AmountSourceLine source={sources.total} />

          {booking.paymentState ? (
            <dl className="space-y-2 pt-3">
              <Amount label={t('booking.detailPage.paymentState')}>
                <span data-testid="booking-payment-state" data-state={booking.paymentState}>
                  {t(`booking.list.payment.${booking.paymentState}`)}
                </span>
              </Amount>
              {collected !== null ? (
                <Amount label={t('booking.detailPage.paidAmount')} source={sources.paid}>
                  <span data-testid="booking-paid-amount">{money(collected)}</span>
                </Amount>
              ) : null}
              {balance !== null && balance > 0 ? (
                <Amount label={t('booking.detailPage.balanceDue')} source={sources.balance}>
                  <span data-testid="booking-balance-due">{money(balance)}</span>
                </Amount>
              ) : null}
            </dl>
          ) : null}

          {canRecord ? (
            <div className="pt-2">
              <Button type="button" variant="outline" onClick={() => setRecordOpen(true)} data-testid="booking-record-payment">
                {t('booking.detailPage.recordPayment')}
              </Button>
              <RecordPaymentDialog bookingId={booking.id} balance={balance} open={recordOpen} onOpenChange={setRecordOpen} />
            </div>
          ) : null}
        </div>
      </PlainSection>

      {/* NF-77, ADR-033-R8: what the channel says about the money of an imported booking; nothing for any other booking and for who
          may not read payments (the API sends no amounts to them). */}
      <BookingOtaAmounts booking={booking} />
    </div>
  );
}
