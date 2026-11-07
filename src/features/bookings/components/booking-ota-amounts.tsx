import { useTranslation } from 'react-i18next';
import { PlainSection } from '@/components/shared/calm';
import { formatCurrency } from '@/lib/utils';
import type { Booking } from '@/types';
import { Amount, Fact, Facts } from './booking-facts';

/** A figure the channel sent is a number; a figure it did not send is `null` (or missing), and is never shown as 0. */
const isFigure = (value: number | null | undefined): value is number => typeof value === 'number' && Number.isFinite(value);

/**
 * The total of a channel booking. Its column cannot be null: when the channel did not send a price the API leaves the 0 of the column,
 * and `amountSources.total` still says "channel manager". A total that is not above 0 is no figure the channel gave, so the section says
 * "not available" (with no source) instead of "0,00 €".
 */
const totalOf = (booking: Booking): number | null => (isFigure(booking.totalPrice) && booking.totalPrice > 0 ? booking.totalPrice : null);

/**
 * "Importi del canale" (NF-77, ADR-033-R8): what the channel says about the money of an imported booking, in plain words: the total,
 * the commission, what the host receives (the net), what is paid and what is left, the state of the payment and who collects. Every
 * figure says where it comes from (`amountSources`). The channel often does not send the commission, the net or the balance: a
 * figure that is missing says "not available" and is never drawn as 0, so a real 0 (a balance that is settled) stays distinct. The
 * total is one of them when the channel sent no price (`totalOf`).
 *
 * It draws nothing for a booking without `otaAmounts`: not a channel booking, or the caller may not read payments, who gets the state
 * of the payment without any amount (the API leaves the amounts out for them).
 */
export function BookingOtaAmounts({ booking }: { booking: Booking }) {
  const { t } = useTranslation();
  const amounts = booking.otaAmounts;
  if (!amounts) return null;

  const sources = booking.amountSources ?? {};
  const money = (value: number) => formatCurrency(value, booking.currency);
  const notAvailable = t('booking.otaAmounts.notAvailable');
  const collection = booking.collection;

  const rows = [
    { id: 'total', label: t('booking.detailPage.total'), value: totalOf(booking), source: sources.total },
    { id: 'commission', label: t('booking.otaAmounts.commission'), value: amounts.commission, source: sources.commission },
    { id: 'net', label: t('booking.otaAmounts.net'), value: amounts.net, source: sources.net },
    { id: 'paid', label: t('booking.otaAmounts.paid'), value: amounts.paid, source: sources.paid },
    { id: 'balance', label: t('booking.otaAmounts.balance'), value: amounts.balance, source: sources.balance },
  ];
  const someMissing = rows.some((row) => !isFigure(row.value));

  const collector =
    collection?.companyCollect === true
      ? t('booking.otaAmounts.collectorChannel')
      : collection?.companyCollect === false
        ? t('booking.otaAmounts.collectorHost')
        : null;
  const commissionIncluded =
    collection?.commissionIncludedInPayments === true
      ? t('booking.otaAmounts.commissionIncluded')
      : collection?.commissionIncludedInPayments === false
        ? t('booking.otaAmounts.commissionNotIncluded')
        : null;

  return (
    <PlainSection title={t('booking.otaAmounts.title')} data-testid="booking-ota-amounts">
      <div className="max-w-xl space-y-3">
        <dl className="space-y-2">
          {rows.map((row) =>
            isFigure(row.value) ? (
              <Amount key={row.id} label={row.label} source={row.source}>
                <span data-testid={`booking-ota-${row.id}`}>{money(row.value)}</span>
              </Amount>
            ) : (
              <Amount key={row.id} label={row.label}>
                <span className="text-foreground/70" data-testid={`booking-ota-${row.id}`} data-missing="true">
                  {notAvailable}
                </span>
              </Amount>
            ),
          )}
        </dl>

        <Facts className="pt-1">
          {booking.paymentState ? (
            <Fact label={t('booking.detailPage.paymentState')}>
              <span data-testid="booking-ota-payment-state" data-state={booking.paymentState}>
                {t(`booking.list.payment.${booking.paymentState}`)}
              </span>
            </Fact>
          ) : null}
          <Fact label={t('booking.otaAmounts.collector')}>
            <span className={collector ? undefined : 'text-foreground/70'} data-testid="booking-ota-collector">
              {collector ?? notAvailable}
            </span>
          </Fact>
          <Fact label={t('booking.otaAmounts.commissionPayments')}>
            <span className={commissionIncluded ? undefined : 'text-foreground/70'} data-testid="booking-ota-commission-included">
              {commissionIncluded ?? notAvailable}
            </span>
          </Fact>
        </Facts>

        {someMissing ? (
          <p className="text-sm text-foreground/70" data-testid="booking-ota-some-missing">
            {t('booking.otaAmounts.someMissing')}
          </p>
        ) : null}
      </div>
    </PlainSection>
  );
}
