import type { TFunction } from 'i18next';
import { formatDocumentAmount } from '@/features/fiscal/documents/document-model';
import { translateErrorCode } from '@/lib/api-errors';
import { keptKeyOf } from './self-billing-model';

/** A missing amount is never a zero: nothing is shown for a figure that is not a number. */
export const money = (amount: number, currency: string, language: string) => formatDocumentAmount(amount, currency, language);

/** The word of a code when the app has one, else the code as it came (the server is newer): never a blank. */
export function codeWords(prefix: string, code: string, t: TFunction, exists: (key: string) => boolean): string {
  const key = `${prefix}.${code}`;
  return exists(key) ? t(key) : (translateErrorCode(code, t) ?? code);
}

/** What a draft that replaces a rejected TD17 says of it: its number (the draft holds it) when there is one. */
export function replacesWords(t: TFunction, number: string | null): string {
  return number ? t('selfBilling.row.replaces', { number }) : t('selfBilling.row.replacesUnknown');
}

/**
 * Why a draft is kept, in words, and, for a person who may close it, the way out too («chiudila come non più dovuta», the number never given again). Someone who cannot (the flag of the sending is off) is not invited to an
 * action that is not drawn for them.
 */
export function keptWords(t: TFunction, code: string, mayClose: boolean): string {
  const why = t(keptKeyOf(code), { code });
  return mayClose ? `${why} ${t('selfBilling.kept.exit')}` : why;
}
