import { useMemo } from 'react';
import { useOwnerFormat, type OwnerFormat } from '@/features/owner-accounting/use-owner-format';

/** True when the server named a currency for an amount: an empty code is no currency (`AgencyBalance`, the rows of a document with no currency stored). */
export const hasCurrency = (currency: string | null | undefined): currency is string => typeof currency === 'string' && currency.trim() !== '';

export interface SummaryFormat {
  /**
   * An amount in the currency the row names, with the symbol or the code that currency has in the language of the app: the currency comes from the data and is never assumed, so a row in
   * francs and a row in euros are written each in its own. An amount with no currency (the row names none) is the figure alone, two decimals and no symbol.
   */
  money: (amount: number, currency: string | null | undefined) => string;
  /** An amount the server sends with no currency at all (the stays, the collections, the costs of the channels, the Italian tourist tax): the figure alone, never a symbol. */
  plain: OwnerFormat['amount'];
  /** A rate the server already gives in percent (the `ratePercent` of a VAT line: `8.1` is `8,1%`). */
  percent: OwnerFormat['percent'];
  /** A rate the server gives from 0 to 1 (an occupancy, the cost over the gross): `0.66` is `66%`. The language writes it, nothing here multiplies it. */
  ratio: (value: number) => string;
  date: OwnerFormat['date'];
  month: OwnerFormat['month'];
  /** A whole number as the language of the app writes it (`1.234`). */
  count: (value: number) => string;
}

/** The writers of the figures of the summary: every one of them shows what the server sent, none rounds, adds up or converts. */
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
