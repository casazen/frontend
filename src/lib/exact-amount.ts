/** More decimals than any currency has, so that a figure the server wrote is never cut by the format: what it sends is what is shown. */
const MAX_FRACTION_DIGITS = 4;

export const CURRENCY_CODE = /^[A-Za-z]{3}$/;
const AMOUNT_FORMATS = new Map<string, Intl.NumberFormat>();

export function exactNumberFormat(language: string, currency: string | null): Intl.NumberFormat {
  const key = `${language}|${currency ?? ''}`;
  const known = AMOUNT_FORMATS.get(key);
  if (known) return known;
  const options: Intl.NumberFormatOptions = currency
    ? { style: 'currency', currency: currency.toUpperCase(), maximumFractionDigits: MAX_FRACTION_DIGITS }
    : { maximumFractionDigits: MAX_FRACTION_DIGITS };
  let format: Intl.NumberFormat;
  try {
    format = new Intl.NumberFormat(language, options);
  } catch {
    format = new Intl.NumberFormat('it', options);
  }
  AMOUNT_FORMATS.set(key, format);
  return format;
}

export function formatExactAmount(amount: number, currency: string, language: string): string {
  if (CURRENCY_CODE.test(currency)) return exactNumberFormat(language, currency).format(amount);
  return `${exactNumberFormat(language, null).format(amount)} ${currency}`.trim();
}
