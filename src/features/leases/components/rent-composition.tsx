import { useTranslation } from 'react-i18next';
import { formatCurrency } from '@/lib/utils';
import { rentBreakdown, type RentMoneySource } from '../lib/rent-breakdown';

const LINES = [
  ['rent', 'rent'],
  ['condominiumAdvance', 'advance'],
  ['condominiumSettlement', 'settlement'],
  ['other', 'other'],
  ['total', 'total'],
  ['paid', 'paid'],
  ['residual', 'residual'],
] as const;

/**
 * The seven figures of one rent-ledger row. A part the API did not send is an em dash; the total is the current
 * amount, so the row still works before components exist.
 */
export function RentComposition({ row, currency }: { row: RentMoneySource; currency: string }) {
  const { t } = useTranslation();
  const parts = rentBreakdown(row);
  return (
    <dl className="min-w-44 space-y-0.5 text-sm" data-testid="rent-composition">
      {LINES.map(([field, key]) => {
        const value = parts[field];
        return (
          <div key={field} className="flex items-baseline justify-between gap-3">
            <dt className="text-foreground/70">{t(`rent.composition.${key}`)}</dt>
            <dd className="whitespace-nowrap font-medium" data-testid={`rent-composition-${field}`}>
              {value === null ? '—' : formatCurrency(value, currency)}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
