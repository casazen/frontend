const DIGITS = /^\d+$/;
const DECIMALS = /^\d{0,2}$/;

export interface ParsedEuros {
  /** The amount in cents; `null` when the text is blank or is not an amount. */
  cents: number | null;
  problem: 'blank' | 'invalid' | null;
}

/**
 * An amount in euros as a person writes it, in cents (the API counts in cents, so no float ever holds a price): `45`,
 * `45,5`, `45.50`, `1.234,56`, `1,234.56`, `€ 45`. Where both separators appear the last one is the decimal point and the
 * other groups the thousands; a lone separator followed by exactly three digits groups the thousands (`1.500` is 1500,
 * as an Italian writes it), otherwise it is the decimal point. More than two decimals, a sign or a letter is not an amount.
 */
export function parseEuros(input: string): ParsedEuros {
  const text = input.replace(/[\s€]/g, '');
  if (text === '') return { cents: null, problem: 'blank' };

  const lastComma = text.lastIndexOf(',');
  const lastDot = text.lastIndexOf('.');
  const decimalAt = Math.max(lastComma, lastDot);

  let integer = text;
  let decimals = '';
  if (decimalAt >= 0) {
    const separator = text[decimalAt];
    const other = separator === ',' ? '.' : ',';
    const before = text.slice(0, decimalAt);
    const after = text.slice(decimalAt + 1);
    const groupsOnly = !before.includes(other) && before.includes(separator);
    const lonely = !before.includes(other) && !before.includes(separator);
    if (groupsOnly || (lonely && after.length === 3 && before.length >= 1 && before.length <= 3)) {
      // "1.234.567" and "1.500": thousands only.
      integer = text.split(separator).join('');
    } else {
      integer = before.split(other).join('').split(separator).join('');
      decimals = after;
    }
  }

  // ",50" and ".5" are fifty cents: the zero before the point is not asked.
  if (integer === '' && decimals !== '') integer = '0';
  if (!DIGITS.test(integer) || !DECIMALS.test(decimals)) return { cents: null, problem: 'invalid' };
  return { cents: Number(integer) * 100 + Number(decimals.padEnd(2, '0')), problem: null };
}

/** An amount for the text box of the form: `45` when whole, `45,50` otherwise, with the decimal point of the language. */
export function centsToInput(cents: number | null | undefined, decimalSeparator: ',' | '.'): string {
  if (cents === null || cents === undefined) return '';
  const whole = Math.floor(cents / 100);
  const rest = cents % 100;
  return rest === 0 ? String(whole) : `${whole}${decimalSeparator}${String(rest).padStart(2, '0')}`;
}

/** An amount to read: `45 €`, `45,50 €`, `€45` in English. Whole amounts have no decimals. */
export function formatMoney(cents: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}
