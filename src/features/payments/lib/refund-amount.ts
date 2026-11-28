const AMOUNT_PATTERN = /^\d+(\.\d{1,2})?$/;

export function parseRefundAmount(input: string): number | null {
  const text = input.trim().replace(',', '.');
  if (text === '') return null;
  return AMOUNT_PATTERN.test(text) ? Number(text) : Number.NaN;
}

export function toCents(amount: number): number {
  return Math.round(amount * 100);
}
