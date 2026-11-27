/** More decimals than any currency has, so that a figure the server wrote is never cut by the format: what it sends is what is shown. */
const MAX_FRACTION_DIGITS = 4;

/** A currency of the server that is a code (`EUR`); anything else is written after the number as it came. */
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
    // A language tag the runtime does not know: the page's own default, never a crash on a money screen.
    format = new Intl.NumberFormat('it', options);
  }
  AMOUNT_FORMATS.set(key, format);
  return format;
}

/**
 * An amount as the server wrote it, in the language of the person and in the currency given: no sum, no rounding to another unit, no conversion, and never an assumed euro
 * (a currency that is not a code is written after the number as it came).
 */
export function formatExactAmount(amount: number, currency: string, language: string): string {
  if (CURRENCY_CODE.test(currency)) return exactNumberFormat(language, currency).format(amount);
  return `${exactNumberFormat(language, null).format(amount)} ${currency}`.trim();
}
