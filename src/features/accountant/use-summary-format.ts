import { useMemo } from 'react';
import { useOwnerFormat, type OwnerFormat } from '@/features/owner-accounting/use-owner-format';

export const hasCurrency = (currency: string | null | undefined): currency is string => typeof currency === 'string' && currency.trim() !== '';

export interface SummaryFormat {
  money: (amount: number, currency: string | null | undefined) => string;
  plain: OwnerFormat['amount'];
  /** A rate the server already gives in percent (the `ratePercent` of a VAT line: `8.1` is `8,1%`). */
  percent: OwnerFormat['percent'];
  ratio: (value: number) => string;
  date: OwnerFormat['date'];
  month: OwnerFormat['month'];
  count: (value: number) => string;
}

export function useSummaryFormat(): SummaryFormat {
  const format = useOwnerFormat();
  return useMemo(() => {
    const integer = new Intl.NumberFormat(format.locale);
    const ratio = new Intl.NumberFormat(format.locale, { style: 'percent', maximumFractionDigits: 2 });
    return {
      money: (amount, currency) => (hasCurrency(currency) ? format.money(amount, currency.trim()) : format.amount(amount)),
      plain: format.amount,
      percent: format.percent,
      ratio: (value) => ratio.format(value),
      date: format.date,
      month: format.month,
      count: (value) => integer.format(value),
    };
  }, [format]);
}
