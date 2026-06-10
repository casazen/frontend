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
  const lodgingTotal = nightlyRate * nights;

  return (
    <div className="space-y-2 rounded-lg border p-4 text-sm" data-testid="price-breakdown">
      <h3 className="font-semibold">Riepilogo prezzi</h3>
      <div className="flex justify-between">
        <span>
          {nights} notte{nights !== 1 ? 'i' : ''} × {formatCurrency(nightlyRate, currency)}
        </span>
        <span>{formatCurrency(lodgingTotal, currency)}</span>
      </div>
      <div className="flex justify-between">
        <span>Pulizia</span>
        <span>{formatCurrency(cleaningFee, currency)}</span>
      </div>
      <div className="flex justify-between">
        <span>Tassa di soggiorno</span>
        <span>{formatCurrency(touristTaxAmount, currency)}</span>
      </div>
      <div className="flex justify-between border-t pt-2 text-base font-semibold">
        <span>Totale</span>
        <span>{formatCurrency(totalAmount, currency)}</span>
      </div>
    </div>
  );
}
