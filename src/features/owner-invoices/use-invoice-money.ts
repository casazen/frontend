import { useOwnerFormat } from '@/features/owner-accounting/use-owner-format';

export function useInvoiceMoney() {
  const { money, amount } = useOwnerFormat();
  return (value: number, currency: string | null | undefined): string => (currency && currency.trim() !== '' ? money(value, currency) : amount(value));
}

export const hasNoCurrency = (invoice: { currency: string | null | undefined }): boolean => !invoice.currency || invoice.currency.trim() === '';
