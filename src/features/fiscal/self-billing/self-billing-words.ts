import type { TFunction } from 'i18next';
import { formatDocumentAmount } from '@/features/fiscal/documents/document-model';
import { translateErrorCode } from '@/lib/api-errors';
import { keptKeyOf } from './self-billing-model';

export const money = (amount: number, currency: string, language: string) => formatDocumentAmount(amount, currency, language);

export function codeWords(prefix: string, code: string, t: TFunction, exists: (key: string) => boolean): string {
  const key = `${prefix}.${code}`;
  return exists(key) ? t(key) : (translateErrorCode(code, t) ?? code);
}

export function replacesWords(t: TFunction, number: string | null): string {
  return number ? t('selfBilling.row.replaces', { number }) : t('selfBilling.row.replacesUnknown');
}

export function keptWords(t: TFunction, code: string, mayClose: boolean): string {
  const why = t(keptKeyOf(code), { code });
  return mayClose ? `${why} ${t('selfBilling.kept.exit')}` : why;
}
