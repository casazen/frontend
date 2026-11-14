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

/**
 * The end of the bank account of a person to pay, as a list of payments may show it (`•••• 3456`): the last four characters and nothing else. The registry of the owners
 * already answers the account masked (`****3456`); this cuts whatever arrives to the same four, so an account that reached the page in full by mistake is never drawn
 * (or kept by the cache) in full. `null` when there is no account.
 */
export function ibanEnd(value: string | null | undefined): string | null {
  if (value === null || value === undefined || value.trim() === '') return null;
  const compact = value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  return compact === '' ? '••••' : `•••• ${compact.slice(-4)}`;
}
