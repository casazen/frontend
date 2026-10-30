import { useTranslation } from 'react-i18next';
import { useSiteMoney } from '@/features/public-site/hooks/use-site-money';
import type { TouristTaxQuoteStatus } from '@/types';

export interface PriceBreakdownTouristTax {
  status: TouristTaxQuoteStatus;
  /** Only meaningful when `status` is `Calculated`. */
  amount: number | null;
}

interface PriceBreakdownProps {
  nights: number;
  nightlyRate: number;
  cleaningFee: number;
  /** Tourist tax computed by the backend (quote or booking): never estimated here (BK-03, R-05). */
  touristTax: PriceBreakdownTouristTax;
  totalAmount: number;
  currency?: string;
}

/**
 * Price of the stay as the backend computed it. The tourist tax is part of the total when calculated
 * (spec-direct-checkout AC6: charged with the rest); when CasaZen has no rate it says so and adds nothing.
 */
export function PriceBreakdown({
  nights,
  nightlyRate,
  cleaningFee,
  touristTax,
  totalAmount,
  currency = 'EUR',
}: PriceBreakdownProps) {
  const { t } = useTranslation();
  const money = useSiteMoney();
  const lodgingTotal = nightlyRate * nights;
  const calculated = touristTax.status === 'Calculated';
  const unavailable = touristTax.status === 'RateUnavailable' || touristTax.status === 'CategoryRequired'
    || touristTax.status === 'NightlyPriceRequired';

  return (
    <div className="space-y-2 rounded-lg border p-4 text-sm" data-testid="price-breakdown">
      <h3 className="font-semibold">{t('publicBooking.priceBreakdownTitle')}</h3>
      <div className="flex justify-between">
        <span>
          {t('publicBooking.nightsBreakdown', { count: nights, rate: money(nightlyRate, currency) })}
        </span>
        <span>{money(lodgingTotal, currency)}</span>
      </div>
      <div className="flex justify-between">
        <span>{t('publicBooking.pulizia')}</span>
        <span>{money(cleaningFee, currency)}</span>
      </div>
      <div className="flex justify-between gap-4" data-testid="tourist-tax-line">
        <span>{calculated ? t('publicBooking.touristTaxIncluded') : t('publicBooking.tassaSoggiorno')}</span>
        <span className={calculated ? undefined : 'text-right text-muted-foreground'}>
          {calculated
            ? money(touristTax.amount ?? 0, currency)
            : unavailable
              ? t('publicBooking.touristTaxUnavailable')
              : t('publicBooking.touristTaxAgesRequired')}
        </span>
      </div>
      {unavailable && (
        <p className="text-xs text-muted-foreground" data-testid="tourist-tax-unavailable">
          {t('publicBooking.touristTaxUnavailableHint')}
        </p>
      )}
      <div className="flex justify-between border-t pt-2 text-base font-semibold">
        <span>{t('publicBooking.totale')}</span>
        <span data-testid="price-breakdown-total">{money(totalAmount, currency)}</span>
      </div>
    </div>
  );
}
