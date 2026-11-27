/** SEPA Direct Debit from a linked Italian or EU account. The session lists Italian banks. Not a US account. */
export function bankLinkDebitAvailable(currency: string | null | undefined): boolean {
  return currency?.trim().toLowerCase() === 'eur';
}

/** Major units (the rest of the rent screens) to the cents the bank-link payment expects. */
export function toBankLinkCents(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100);
}
