import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { localeOf } from '@/features/owner-accounting/owner-accounting-model';
import { exactMoney } from '@/lib/agency-finance';

/**
 * The writer of the amounts of the agency's money pages in the language of the app: `money(830.25, 'CHF')` is the figure of the server in its own currency,
 * never rounded and never an assumed euro (see `exactMoney`).
 */
export function useExactMoney(): (amount: number, currency: string) => string {
  const { i18n } = useTranslation();
  const locale = localeOf(i18n.language);
  return useCallback((amount: number, currency: string) => exactMoney(amount, currency, locale), [locale]);
}
