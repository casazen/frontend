import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { formatRomeDateTime, formatStayDate } from '@/lib/stay-dates';
import { formatCurrency } from '@/lib/utils';
import { asInstant, localeOf } from './owner-accounting-model';

export interface OwnerFormat {
  locale: string;
  /** An amount in its own currency (the currency of a statement is the owner's, never an assumed euro). */
  money: (amount: number, currency: string) => string;
  /** A day (`yyyy-MM-dd`) as the language of the app writes it; empty for none. */
  date: (day: string | null | undefined) => string;
  /** An instant of the API as a date and time in Europe/Rome; empty for none. */
  dateTime: (instant: string | null | undefined) => string;
  /** A month of a year, `ottobre 2026`. */
  month: (year: number, month: number) => string;
  /** A percentage with at most two decimals: `33,33%`. */
  percent: (value: number) => string;
}

/** The formatters of the owner accounting pages in the language of the app. */
export function useOwnerFormat(): OwnerFormat {
  const { i18n } = useTranslation();
  const locale = localeOf(i18n.language);
  return useMemo(
    () => ({
      locale,
      money: (amount, currency) => {
        try {
          return formatCurrency(amount, currency, locale);
        } catch {
          // A code the runtime does not know: the figure and the code as they came, never a blank.
          return `${amount.toFixed(2)} ${currency}`;
        }
      },
      date: (day) => (day ? formatStayDate(day, locale) : ''),
      dateTime: (instant) =>
        instant
          ? formatRomeDateTime(asInstant(instant), locale, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
          : '',
      month: (year, month) => new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(year, month - 1, 1))),
      percent: (value) => `${new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(value)}%`,
    }),
    [locale],
  );
}
