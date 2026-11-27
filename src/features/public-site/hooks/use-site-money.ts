import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { formatMoney } from '@/lib/money-format';
import { siteLocale } from '@/lib/site-language';

/**
 * Writes an amount the way the guest's language does (DB-02b): `145,00 €` in Italian, `€145.00` in English. The function it
 * returns changes with the language, so a component that uses it is drawn again when the guest switches. Pass the currency of the
 * object the amount belongs to (the property, the quote, the booking: a house in Switzerland is in `CHF`); an object that does not
 * say gets no currency at all (CHF-MONEY): the amount is written with no symbol and the phrase that says the currency is not available.
 */
export function useSiteMoney(): (amount: number, currency: string | null | undefined) => string {
  const { t, i18n } = useTranslation();
  const locale = siteLocale(i18n.language);
  return useCallback((amount: number, currency: string | null | undefined) => formatMoney(amount, currency, locale, t), [locale, t]);
}
