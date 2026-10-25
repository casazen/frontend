import { describe, expect, it } from 'vitest';
import it_ from '@/i18n/locales/it.json';
import en from '@/i18n/locales/en.json';

/**
 * CF-FLOW: the contract of a canone concordato is made in a guided form that a supplier runs, and the person goes through CasaZen: its
 * name is never in a text of the app, in either language. The privacy notice, which says who receives the data, is a legal text and does
 * not live in these files. If a text of these files ever has to name it, that is a decision of the owner of the product: do not put the
 * key on a list of exceptions here to make this pass.
 */
const SUPPLIER = /concordato\s*facile/i;

/** Where the guided form is told to the person: there nobody is a «partner» either (the word is for the OTA and payment partners elsewhere). */
const OF_THE_FLOW = [
  'concordatofacile',
  'guidedContract',
  'cfDocuments',
  'leaseDocs',
  'leases.partnerDraft',
  'leases.eventType',
  'leaseFlow.nextStep.AwaitPartnerContract',
  'leaseWizard.start',
  'leaseWizard.type',
  'leaseWizardGuide',
  'apiErrors.codes.concordatofacileAlreadyPurchased',
];

/** Every text of a locale file with the path of its key (arrays count, their items have `[n]` in the path). */
function texts(node: unknown, path = ''): Array<[string, string]> {
  if (typeof node === 'string') return [[path, node]];
  if (Array.isArray(node)) return node.flatMap((item, index) => texts(item, `${path}[${index}]`));
  if (node !== null && typeof node === 'object') {
    return Object.entries(node).flatMap(([key, value]) => texts(value, path ? `${path}.${key}` : key));
  }
  return [];
}

const LOCALES = [
  ['it', it_],
  ['en', en],
] as const;

describe('no name of the supplier of the guided form in the texts (CF-FLOW)', () => {
  it.each(LOCALES)('%s.json: no text names the supplier', (_language, locale) => {
    const all = texts(locale);
    // The scan really covers the file.
    expect(all.length).toBeGreaterThan(5000);

    const named = all.filter(([, text]) => SUPPLIER.test(text)).map(([key, text]) => `${key}: ${text}`);
    expect(named).toEqual([]);
  });

  it.each(LOCALES)('%s.json: the texts of the flow do not call the supplier a «partner» either', (_language, locale) => {
    const inTheFlow = texts(locale).filter(([key]) => OF_THE_FLOW.some((prefix) => key === prefix || key.startsWith(`${prefix}.`)));
    // The scan really reaches them.
    expect(inTheFlow.length).toBeGreaterThan(80);

    const named = inTheFlow.filter(([, text]) => /partner/i.test(text)).map(([key, text]) => `${key}: ${text}`);
    expect(named).toEqual([]);
  });
});
