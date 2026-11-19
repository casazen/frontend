import type { TouristTaxSummary } from '@/types';

/**
 * The summary of a whole year as the server sends it to who reaches every property: 32.345,50 owed, 20.000,00 remitted, 12.345,50 left. Every figure has five digits, so that the grouping of the language shows in it, and the
 * cents are the server's own (`*Cents`): the page writes them and adds nothing up.
 */
export function summaryOf(year: number, change: Partial<TouristTaxSummary> = {}): TouristTaxSummary {
  return {
    title: 'Imposta di soggiorno per comune',
    basis: 'recorded',
    currency: 'EUR',
    paymentsHidden: false,
    period: { from: `${year}-01-01`, to: `${year}-12-31` },
    comuni: [
      {
        comune: 'Milano',
        stays: 4,
        nights: 9,
        guests: 8,
        owed: 32345.5,
        owedCents: 3234550,
        staysWithoutAmount: 0,
        paid: 20000,
        paidCents: 2000000,
        balance: 12345.5,
        balanceCents: 1234550,
        status: 'ToPay',
        remittances: [],
      },
    ],
    total: { stays: 4, nights: 9, guests: 8, owed: 32345.5, owedCents: 3234550, staysWithoutAmount: 0, paid: 20000, paidCents: 2000000, balance: 12345.5, balanceCents: 1234550 },
    ...change,
  };
}
