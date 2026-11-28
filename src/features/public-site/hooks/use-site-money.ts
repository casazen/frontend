import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { formatMoney } from '@/lib/money-format';
import { siteLocale } from '@/lib/site-language';

export function useSiteMoney(): (amount: number, currency: string | null | undefined) => string {
  const { t, i18n } = useTranslation();
  const locale = siteLocale(i18n.language);
  return useCallback((amount: number, currency: string | null | undefined) => formatMoney(amount, currency, locale, t), [locale, t]);
}
