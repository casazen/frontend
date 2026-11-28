import { describe, expect, it } from 'vitest';
import it_ from '@/i18n/locales/it.json';
import en from '@/i18n/locales/en.json';
import guestDe from '@/i18n/locales/guest-checkin.de.json';
import guestFr from '@/i18n/locales/guest-checkin.fr.json';
import guestEs from '@/i18n/locales/guest-checkin.es.json';
import { INVOICE_FIELDS_COPY, INVOICE_FIELDS_COPY_SUFFIXES } from '../invoice-data-copy';
import { INVOICE_ERROR_MESSAGES } from '../invoice-data-schema';
import { INVOICE_DATA_SOURCES, INVOICE_RECIPIENT_KINDS } from '@/types';

type Tree = { [key: string]: string | string[] | Tree };

function textAt(tree: Tree, key: string): string | undefined {
  let node: string | string[] | Tree | undefined = tree;
  for (const part of key.split('.')) {
    if (node === undefined || typeof node === 'string' || Array.isArray(node)) return undefined;
    node = node[part];
  }
  return typeof node === 'string' ? node : undefined;
}

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

describe('texts of the invoice data of the guest page, in the five languages of the page', () => {
  const guest = INVOICE_FIELDS_COPY.guest;
  const keys = [
    ...INVOICE_FIELDS_COPY_SUFFIXES.map((suffix) => `${guest}.${suffix}`),
    ...['title', 'question', 'intro', 'fieldsHint', 'yes.title', 'yes.description', 'no.title', 'no.description'].map((key) => `checkin.invoice.${key}`),
    ...['title', 'body', 'replace', 'keep'].map((key) => `checkin.invoice.onFile.${key}`),
  ];

  it.each([
    ['it', it_],
    ['en', en],
    ['de', guestDe],
    ['fr', guestFr],
    ['es', guestEs],
  ] as const)('guestInvoice_%s_HasEveryTextOfTheStepAndOfItsFields', (_language, locale) => {
    const missing = keys.filter((key) => !textAt(locale as Tree, key)?.trim());

    expect(keys.length).toBeGreaterThan(40);
    expect(missing).toEqual([]);
  });

  it.each([
    ['de', guestDe],
    ['fr', guestFr],
    ['es', guestEs],
  ] as const)('guestInvoice_%s_IsInTheLanguageAndNotACopyOfTheEnglishTexts', (_language, locale) => {
    const sameWord = new Set(['PEC', 'Province']);
    const copied = keys.filter((key) => {
      const text = textAt(locale as Tree, key);
      return text !== undefined && text === textAt(en as Tree, key) && !sameWord.has(text);
    });

    expect(copied).toEqual([]);
  });
});
