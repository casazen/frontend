/**
 * A bank account as a screen may show it again: the country and the check digits, the end, and nothing of the middle. The account a person types is
 * never printed in full afterwards (a screen, a URL, a cache, a storage and a log all keep what they are given), so the confirmation of a payment
 * names the account through this and the full number stays in the field it was typed in.
 */
export function maskIban(iban: string): string {
  const compact = iban.replace(/[\s-]/g, '').toUpperCase();
  // Too short to hide anything and still say something: the caller shows nothing of it.
  if (compact.length < 9) return '••••';
  return `${compact.slice(0, 4)} •••• ${compact.slice(-4)}`;
}
