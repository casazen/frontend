export function bankLinkDebitAvailable(currency: string | null | undefined): boolean {
  return currency?.trim().toLowerCase() === 'eur';
}

export function toBankLinkCents(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100);
}
