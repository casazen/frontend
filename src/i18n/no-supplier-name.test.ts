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

/**
 * E29/F02/US02/T01 (NF-125, decision D13): the card of the regime of the canton, the step of the activation and the part of the plan name the authorities and their portals (Polizia
 * cantonale, notifiche.ti.ch), never the supplier of a software or of a cantonal system that the research met on the way: whoever reads them has no use for the name, and none of them
 * has an interface CasaZen uses. As above: if a text ever has to name one, that is a decision of the owner of the product, not a key to put on a list of exceptions here.
 */
const SOFTWARE_SUPPLIER = /hoko|unisys|u-stay|feratel|chekin|stellar\s*check-?in|chargeautomation|smoobu|lodgify|octorate|concordato\s*facile|\bavs\b/i;

/** Where the regimes of the registration of the guests are told to the person. */
const OF_THE_REGIMES = [
  'guestRegistration',
  // E31/F02/US02: the guest register of a Swiss property and the assisted notification of the cantons other than Ticino, and the sentences of the bell about the second.
  'guestRegister',
  'swissNotification',
  'notifications.types.swissNotificationDue',
  'notifications.types.swissNotificationOverdue',
  'notifications.types.swissNotificationDeclared',
  'onboardingPlan.parts.guestRegistration',
  'onboardingPlan.part.missing',
  'onboardingPlan.reasons.no_swiss_property',
  'onboardingPlan.reasons.swiss_municipality_missing',
  'onboardingPlan.reasons.ticino_structure_id_missing',
  'onboardingPlan.reasons.property.swiss_municipality_missing',
  'onboardingPlan.reasons.property.ticino_structure_id_missing',
  'compliance.activation.steps.guest-registration',
  'compliance.activation.blockerCodes.swiss_municipality_missing',
  'compliance.activation.blockerCodes.ticino_structure_id_missing',
  'compliance.activation.backToStep',
  'propertyWizard.done.open.guest-registration',
  'propertyWizard.done.fix.guest-registration',
  'apiErrors.codes.guestRegistrationCountryNotSupported',
  'apiErrors.codes.guestRegistrationOverrideNotApplicable',
];

describe('no name of a supplier of software or of a cantonal system in the texts of the regimes (E29/F02/US02/T01)', () => {
  it.each(LOCALES)('%s.json: the texts of the regimes name no supplier', (_language, locale) => {
    const inTheRegimes = texts(locale).filter(([key]) => OF_THE_REGIMES.some((prefix) => key === prefix || key.startsWith(`${prefix}.`)));
    // The scan really reaches them: the card, its enums and its sentences are well over fifty texts.
    expect(inTheRegimes.length).toBeGreaterThan(50);

    const named = inTheRegimes.filter(([, text]) => SOFTWARE_SUPPLIER.test(text)).map(([key, text]) => `${key}: ${text}`);
    expect(named).toEqual([]);
  });

  it.each(LOCALES)('%s.json: the texts of the regimes keep the words of the authorities and say it is not legal advice', (language, locale) => {
    const all = Object.fromEntries(texts(locale));

    // The rule the host reads next to every certainty: «check with the municipality or the police», and that CasaZen gives no legal advice.
    for (const certainty of ['Verified', 'Partial', 'Unverified']) {
      const text = all[`guestRegistration.certainty.${certainty}.text`] ?? '';
      expect(text, certainty).toMatch(language === 'it' ? /comune o la polizia/ : /municipality or the police/);
      expect(text, certainty).toMatch(language === 'it' ? /consulenza legale/ : /legal advice/);
    }
  });
});
