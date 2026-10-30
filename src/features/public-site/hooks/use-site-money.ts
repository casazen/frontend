import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { siteLocale } from '@/lib/site-language';
import { formatCurrency } from '@/lib/utils';

/**
 * Writes an amount the way the guest's language does (DB-02b): `145,00 €` in Italian, `€145.00` in English. The function it
 * returns changes with the language, so a component that uses it is drawn again when the guest switches.
 */
export function useSiteMoney(): (amount: number, currency?: string) => string {
  const { i18n } = useTranslation();
  const locale = siteLocale(i18n.language);
  return useCallback((amount: number, currency = 'EUR') => formatCurrency(amount, currency, locale), [locale]);
}
