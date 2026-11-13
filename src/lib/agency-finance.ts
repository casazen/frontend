import { isAxiosError } from 'axios';
import { getHttpStatus, getProblemCode, getProblemMessage, translateErrorCode } from '@/lib/api-errors';

/**
 * The currency of the withholding and of the F24: the form is declared in euro and the server answers no F24 in another currency. The withholding
 * summary and the F24 have no currency field because they have one currency; a statement and a wire file do, and are always shown in their own.
 */
export const F24_CURRENCY = 'EUR';

/**
 * An amount of the server as the money pages write it: the figure and its own currency (`1234,50 CHF`), never rounded. The formatter of a currency rounds to
 * the minor unit, so a figure with more decimals would be shown as another figure; this one writes the usual two and keeps what the server sent beyond them
 * (up to eight). A figure is only formatted here: nothing is added, subtracted, converted or recomputed, and a sign is the server's own.
 */
export function exactMoney(amount: number, currency: string, locale: string): string {
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 8 }).format(amount);
  } catch {
    // A code the runtime does not know: the figure and the code as they came, never a blank.
    return `${amount} ${currency}`;
  }
}

/** The reference of a wire file as the statements print it (`WB-` and the first eight digits of its id): the one a person finds on both papers. */
export function batchReference(batchId: string): string {
  return `WB-${batchId.replace(/-/g, '').slice(0, 8).toUpperCase()}`;
}

/** The stable `code` of a failed call, when the server sent one. */
export function problemCodeOf(error: unknown): string | undefined {
  return isAxiosError(error) ? getProblemCode(error.response?.data) : undefined;
}

type Translate = (key: string) => string;

/**
 * The words for a failure of one of the money pages: the text of its `code` when the app has one, a 404 as «not found» (what the server says of a missing
 * file or statement is a sentence in English, and the cached data of the page says nothing against it), then what the server wrote for another 4xx, and the
 * generic sentence of the action for the rest (a 5xx is never explained by its own text).
 */
export function failureMessage(error: unknown, t: Translate, fallback: string, notFound: string): string {
  const code = problemCodeOf(error);
  const coded = code ? translateErrorCode(code, t) : undefined;
  if (coded) return coded;
  if (getHttpStatus(error) === 404) return notFound;
  return getProblemMessage(error, t) ?? fallback;
}
