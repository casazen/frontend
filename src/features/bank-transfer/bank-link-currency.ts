/** ACH from a Financial Connections account is USD only. An EUR due is refused (`bank_link_debit_unavailable`). */
export function bankLinkDebitAvailable(currency: string | null | undefined): boolean {
  return currency?.trim().toLowerCase() === 'usd';
}

/** Major units (the rest of the rent screens) to the cents the bank-link payment expects. */
export function toBankLinkCents(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100);
}
