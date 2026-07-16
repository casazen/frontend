import { useTranslation } from 'react-i18next';
import { formatCurrency } from '@/lib/utils';

interface PriceBreakdownProps {
  nights: number;
  nightlyRate: number;
  cleaningFee: number;
  touristTaxAmount: number;
  totalAmount: number;
  currency?: string;
}

export function PriceBreakdown({
  nights,
  nightlyRate,
  cleaningFee,
  touristTaxAmount,
  totalAmount,
  currency = 'EUR',
}: PriceBreakdownProps) {
  const { t } = useTranslation();
  const lodgingTotal = nightlyRate * nights;
  const plural = nights !== 1 ? 'i' : '';

  return (
    <div className="space-y-2 rounded-lg border p-4 text-sm" data-testid="price-breakdown">
      <h3 className="font-semibold">{t('publicBooking.priceBreakdownTitle')}</h3>
      <div className="flex justify-between">
        <span>
          {t('publicBooking.nightsBreakdown', { nights, plural, rate: formatCurrency(nightlyRate, currency) })}
        </span>
        <span>{formatCurrency(lodgingTotal, currency)}</span>
      </div>
      <div className="flex justify-between">
        <span>{t('publicBooking.pulizia')}</span>
        <span>{formatCurrency(cleaningFee, currency)}</span>
      </div>
      <div className="flex justify-between">
        <span>{t('publicBooking.tassaSoggiorno')}</span>
        <span>
          {touristTaxAmount > 0
            ? formatCurrency(touristTaxAmount, currency)
            : t('publicBooking.tassaSoggiornoCalculated')}
        </span>
      </div>
      <div className="flex justify-between border-t pt-2 text-base font-semibold">
        <span>{t('publicBooking.totale')}</span>
        <span>{formatCurrency(totalAmount, currency)}</span>
      </div>
    </div>
  );
}
