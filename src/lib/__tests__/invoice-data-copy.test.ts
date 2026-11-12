import { describe, expect, it } from 'vitest';
import it_ from '@/i18n/locales/it.json';
import en from '@/i18n/locales/en.json';
import { INVOICE_FIELDS_COPY, INVOICE_FIELDS_COPY_SUFFIXES } from '../invoice-data-copy';
import { INVOICE_ERROR_MESSAGES } from '../invoice-data-schema';
import { INVOICE_DATA_SOURCES, INVOICE_RECIPIENT_KINDS } from '@/types';

type Tree = { [key: string]: string | string[] | Tree };

/** The text at `key` (`a.b.c`) of a locale file, or undefined when there is none or when the key is not a leaf. */
function textAt(tree: Tree, key: string): string | undefined {
  let node: string | string[] | Tree | undefined = tree;
  for (const part of key.split('.')) {
    if (node === undefined || typeof node === 'string' || Array.isArray(node)) return undefined;
    node = node[part];
  }
  return typeof node === 'string' ? node : undefined;
}

/**
 * The texts of the invoice data (FIS-01, NF-81) that the screens read with a key built from a name: the scanner of the i18n test sees only keys
 * written out, so a text that is missing from a language (and would show as its key) is found here.
 */
describe('texts of the invoice data of the host', () => {
  const host = INVOICE_FIELDS_COPY.host;
  const keys = [
    ...INVOICE_FIELDS_COPY_SUFFIXES.map((suffix) => `${host}.${suffix}`),
    ...INVOICE_RECIPIENT_KINDS.map((kind) => `invoiceData.section.kind.${kind}`),
    ...['fiscalCode', 'vatNumber'].map((field) => `invoiceData.section.missing.${field}`),
    ...INVOICE_DATA_SOURCES.map((source) => `invoiceData.source.${source}`),
  ];

  it('invoiceFieldsCopy_EveryFailureMessageAndEveryFieldText_IsInTheSuffixes', () => {
    for (const message of INVOICE_ERROR_MESSAGES) expect(INVOICE_FIELDS_COPY_SUFFIXES).toContain(`errors.${message}`);
    expect(new Set(INVOICE_FIELDS_COPY_SUFFIXES).size).toBe(INVOICE_FIELDS_COPY_SUFFIXES.length);
  });

  it.each([
    ['it', it_],
    ['en', en],
  ] as const)('invoiceData_%s_HasEveryTextTheScreensReadByAName', (_language, locale) => {
    const missing = keys.filter((key) => !textAt(locale as Tree, key)?.trim());

    expect(keys.length).toBeGreaterThan(40);
    expect(missing).toEqual([]);
  });
});
