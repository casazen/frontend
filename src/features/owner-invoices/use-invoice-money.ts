import { useOwnerFormat } from '@/features/owner-accounting/use-owner-format';

/**
 * The writer of the amounts of an invoice to an owner: the figure in the currency the server wrote, never an assumed euro. An amount that comes with no currency is shown without a symbol
 * (the page says so in words, `ownerInvoice.currencyMissing`): `missing` tells whether a currency is absent.
 */
export function useInvoiceMoney() {
  const { money, amount } = useOwnerFormat();
  return (value: number, currency: string | null | undefined): string => (currency && currency.trim() !== '' ? money(value, currency) : amount(value));
}

/** True when an invoice carries no currency: its amounts are shown without a symbol and the page says why. */
export const hasNoCurrency = (invoice: { currency: string | null | undefined }): boolean => !invoice.currency || invoice.currency.trim() === '';
