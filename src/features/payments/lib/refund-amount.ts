const AMOUNT_PATTERN = /^\d+(\.\d{1,2})?$/;

/**
 * Amount typed by the host (dot or comma decimal separator, at most two decimals). Returns
 * `null` for an empty field and `NaN` for anything that is not a valid non-negative amount.
 */
export function parseRefundAmount(input: string): number | null {
  const text = input.trim().replace(',', '.');
  if (text === '') return null;
  return AMOUNT_PATTERN.test(text) ? Number(text) : Number.NaN;
}

/** Cents, to compare amounts without floating point surprises. */
export function toCents(amount: number): number {
  return Math.round(amount * 100);
}
