import type { TFunction } from 'i18next';

/**
 * How an amount of money is written for a guest (the booking site and the widgets of the host's own site). The currency comes only from the
 * data the amount came with: nothing in the code chooses one. When the data carries no usable currency (none at all, or something that is not
 * an ISO 4217 code) the amount is written with no symbol and no code, followed by a short phrase that says the currency is not available: never a
 * euro that nobody said, and never a page that stops because `Intl` refused the code (a code that is not three letters makes `Intl.NumberFormat`
 * throw a `RangeError`, and a render that throws blanks the page).
 */

/** What an ISO 4217 code looks like: three letters. `Intl` takes every such code, known or not, and throws for anything else. */
const CURRENCY_CODE = /^[A-Za-z]{3}$/;

/** The code in the shape `Intl` takes (three letters, upper case), or `null` when the data gives none or gives something that is not a code. Nothing is guessed. */
export function currencyCodeOf(currency: string | null | undefined): string | null {
  if (typeof currency !== 'string') return null;
  const code = currency.trim();
  return CURRENCY_CODE.test(code) ? code.toUpperCase() : null;
}

/** How many decimals an amount is written with. Without it a currency writes its own (two for the euro and the franc). */
export interface MoneyDigits {
  minimumFractionDigits: number;
  maximumFractionDigits: number;
}

/** An amount with no currency still is money: it keeps its cents. */
const BARE_DIGITS: MoneyDigits = { minimumFractionDigits: 2, maximumFractionDigits: 2 };

/** The formats are kept: a calendar writes hundreds of prices at every render and an `Intl.NumberFormat` is slow to make. */
const formats = new Map<string, Intl.NumberFormat>();

function numberFormat(locale: string, code: string | null, digits: MoneyDigits | undefined): Intl.NumberFormat {
  const wanted = code ? digits : (digits ?? BARE_DIGITS);
  const key = `${locale}|${code ?? ''}|${wanted ? `${wanted.minimumFractionDigits}-${wanted.maximumFractionDigits}` : ''}`;
  let format = formats.get(key);
  if (!format) {
    format = new Intl.NumberFormat(locale, code ? { style: 'currency', currency: code, ...wanted } : wanted);
    formats.set(key, format);
  }
  return format;
}

/**
 * An amount with nothing said about its currency: only the number, in the language of the page (`145,00`). It is for the places where there is no one currency to
 * name (a slider that spans homes of two currencies) or no room for the phrase (a cell of the calendar, which has the phrase in its name): never for data that lacks a
 * currency where there is room to say so, which `formatMoney` writes with the phrase.
 */
export function formatAmount(amount: number, locale: string, digits?: MoneyDigits): string {
  return numberFormat(locale, null, digits).format(amount);
}

/**
 * An amount in the language of the page: `145,00 €` in Italian, `€145.00` in English, `CHF 145.00` for a home in Switzerland. The currency is the one
 * the data says (`currency`, an ISO 4217 code), never a default. When the data says none, or says something that is not a code, the amount is written
 * with no symbol and the phrase of `siteMoney.currencyNotAvailable` after it (`145,00 (valuta non disponibile)`), and nothing is converted. It never throws.
 */
export function formatMoney(amount: number, currency: string | null | undefined, locale: string, t: TFunction, digits?: MoneyDigits): string {
  const code = currencyCodeOf(currency);
  const written = numberFormat(locale, code, digits).format(amount);
  return code ? written : `${written} (${t('siteMoney.currencyNotAvailable')})`;
}
