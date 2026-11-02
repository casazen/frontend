import { describe, expect, it } from 'vitest';
import it_ from '@/i18n/locales/it.json';
import en from '@/i18n/locales/en.json';

/**
 * Nothing the booking, the request of the customer (and the request on measure, SP-12c) and the payment page say may be untrue (D24, decisions VT-D1/VT-D2): no cash, no
 * deposit, no text message, no review, no promise of how fast the professional answers, no date of accounting or time of refund, no name
 * of the supplier of the guided form nor «partner». The texts are scanned, not the pages: a new sentence that breaks a rule fails here.
 */
const FAMILIES = ['supplierSite.booking', 'supplierSite.request', 'supplierSite.inquiry', 'servicePayment'];

function texts(node: unknown, path = ''): Array<[string, string]> {
  if (typeof node === 'string') return [[path, node]];
  if (Array.isArray(node)) return node.flatMap((item, index) => texts(item, `${path}[${index}]`));
  if (node !== null && typeof node === 'object') return Object.entries(node).flatMap(([key, value]) => texts(value, path ? `${path}.${key}` : key));
  return [];
}

function of(locale: unknown, family: string): Array<[string, string]> {
  const node = family.split('.').reduce<unknown>((current, key) => (current as Record<string, unknown> | undefined)?.[key], locale);
  return texts(node, family);
}

const BANNED: Array<[string, RegExp]> = [
  ['cash', /contanti|\bcash\b/i],
  ['deposit', /acconto|\bdeposit\b|saldo/i],
  ['text message', /\bSMS\b/],
  ['review', /recension|\breview/i],
  ['speed of the answer', /risponde in un.ora|answers? within an hour/i],
  ['the supplier of the guided form', /concordato\s*facile/i],
  ['partner', /\bpartner\b/i],
  // A time or a date of accounting / refund is never promised.
  ['a time of accounting', /\b(entro|in|within)\s+\d+\s*(giorni|giorno|ore|ora|days?|hours?|minuti|minutes?)\b/i],
];

describe('the texts of the booking, the request and the payment page', () => {
  it.each([
    ['it', it_],
    ['en', en],
  ] as const)('%s: no sentence breaks a rule of what may be said', (_language, locale) => {
    const all = FAMILIES.flatMap((family) => of(locale, family));
    expect(all.length).toBeGreaterThan(200);

    const broken = all.flatMap(([key, text]) => BANNED.filter(([, pattern]) => pattern.test(text)).map(([rule]) => `${key} (${rule}): ${text}`));
    expect(broken).toEqual([]);
  });
});
