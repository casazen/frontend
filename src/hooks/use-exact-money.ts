import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { localeOf } from '@/features/owner-accounting/owner-accounting-model';
import { exactMoney } from '@/lib/agency-finance';

export function useExactMoney(): (amount: number, currency: string) => string {
  const { i18n } = useTranslation();
  const locale = localeOf(i18n.language);
  return useCallback((amount: number, currency: string) => exactMoney(amount, currency, locale), [locale]);
}
