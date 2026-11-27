import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { formatRomeDateTime, formatStayDate } from '@/lib/stay-dates';
import { formatCurrency } from '@/lib/utils';
import { asInstant, localeOf } from './owner-accounting-model';

export interface OwnerFormat {
  locale: string;
  money: (amount: number, currency: string) => string;
  amount: (amount: number) => string;
  date: (day: string | null | undefined) => string;
  dateTime: (instant: string | null | undefined) => string;
  month: (year: number, month: number) => string;
  percent: (value: number) => string;
}

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
          return `${amount.toFixed(2)} ${currency}`;
        }
      },
      amount: (amount) => new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount),
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
