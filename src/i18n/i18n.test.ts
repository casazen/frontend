import { describe, expect, it, beforeEach } from 'vitest';
import { z } from 'zod';
import i18n from '@/i18n/config';
import it_ from '@/i18n/locales/it.json';
import en from '@/i18n/locales/en.json';
import guestDe from '@/i18n/locales/guest-checkin.de.json';
import guestFr from '@/i18n/locales/guest-checkin.fr.json';
import guestEs from '@/i18n/locales/guest-checkin.es.json';
import { GUEST_LOCALE_OPTIONS } from '@/features/checkin/lib/guest-locale';
import { GUEST_ERROR_KEYS } from '@/features/checkin/lib/guest-errors';
import { STATISTICAL_FIELD_OPTIONS } from '@/features/checkin/schemas/checkin.schema';
import { CHECKIN_WIZARD_STEPS, ISSUE_FIELD_LABEL_KEYS, ISSUE_TEXT_KEYS } from '@/features/checkin/wizard/lib/checkin-wizard-model';
import {
  getBookingStatusLabel,
  getOtaConnectionStatusLabel,
  getPlanTierLabel,
  getRentalTypeLabel,
  getRoleLabel,
  getServiceCategoryLabel,
  persistLocale,
  readPersistedLocale,
} from '@/lib/i18n-labels';
import { COMMON_AMENITIES } from '@/features/properties/schemas/property.schema';
import { LEASE_EVENT_TYPES, LEASE_STATUSES } from '@/types';
import { COMBUSTION_APPLIANCES, SAFETY_DETECTOR_TYPES, SAFETY_ITEM_CODES } from '@/types/compliance.types';
import { STATUS_DICTIONARY, type StatusDefinition } from '@/lib/status-dictionary';

type LocaleTree = { [key: string]: string | string[] | LocaleTree };

/** Flattens a locale file into `a.b.c -> value`. */
function flatten(tree: LocaleTree, prefix = ''): Map<string, string | string[]> {
  const out = new Map<string, string | string[]>();
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string' || Array.isArray(value)) {
      out.set(path, value);
    } else {
      for (const [k, v] of flatten(value, path)) out.set(k, v);
    }
  }
  return out;
}

const itKeys = flatten(it_ as LocaleTree);
const enKeys = flatten(en as LocaleTree);

const PLURAL_SUFFIX = /_(zero|one|two|few|many|other)$/;

/** A leaf, plural base or object key used with returnObjects resolves in the locale. */
function hasKey(keys: Map<string, unknown>, key: string): boolean {
  return keys.has(key) || keys.has(`${key}_other`) || [...keys.keys()].some((path) => path.startsWith(`${key}.`));
}

function placeholders(value: string | string[]): string[] {
  const text = Array.isArray(value) ? value.join('\n') : value;
  const vars = [...text.matchAll(/\{\{\s*([\w.]+)\s*(?:,[^}]*)?\}\}/g)].map((m) => `{{${m[1]}}}`);
  const tags = [...text.matchAll(/<\/?(\w+)\s*\/?>/g)].map((m) => `<${m[1]}>`);
  return [...new Set([...vars, ...tags])].sort();
}

// Sources of the app (tests excluded): used to check that static keys exist.
const SOURCES = import.meta.glob<string>(['/src/**/*.{ts,tsx}', '!/src/**/*.test.{ts,tsx}', '!/src/**/__tests__/**', '!/src/test/**'], {
  query: '?raw',
  import: 'default',
  eager: true,
});

/**
 * Static i18n keys referenced by the code:
 * - `t('a.b')`, `i18n.t("a.b")`, `` t(`a.b`) `` (no interpolation), `<Trans i18nKey="a.b">`;
 * - properties holding a key (`navKey: 'nav.x'`, `titleKey`, `descriptionKey`, ...);
 * - messages of Zod schemas (they are i18n keys translated by FormFieldError).
 */
function collectUsedKeys(sources: Record<string, string> = SOURCES): Map<string, string> {
  const used = new Map<string, string>();
  const namespaces = Object.keys(it_);
  const keyShape = /^[a-zA-Z][\w-]*(\.[\w-]+)+$/;
  const add = (key: string, file: string) => {
    if (keyShape.test(key)) used.set(key, file);
  };

  for (const [file, source] of Object.entries(sources)) {
    for (const m of source.matchAll(/(?<![\w.])(?:i18n\.)?t\(\s*(['"`])([^'"`$\s]+)\1/g)) add(m[2], file);
    for (const m of source.matchAll(/i18nKey=["']([^"']+)["']/g)) add(m[1], file);
    for (const m of source.matchAll(/\b\w*Key:\s*['"]([^'"]+)['"]/g)) {
      if (namespaces.includes(m[1].split('.')[0])) add(m[1], file);
    }
    if (/from ['"]zod['"]/.test(source)) {
      for (const m of source.matchAll(/['"]([a-zA-Z]+(?:\.[\w-]+)+)['"]/g)) {
        if (namespaces.includes(m[1].split('.')[0])) add(m[1], file);
      }
    }
  }
  return used;
}

describe('i18n helpers', () => {
  beforeEach(async () => {
    localStorage.clear();
    await i18n.changeLanguage('it');
  });

  it('returns Italian booking status labels', () => {
    const t = i18n.getFixedT('it');
    expect(getBookingStatusLabel('Confirmed', t)).toBe('Confermata');
    expect(getBookingStatusLabel('Pending', t)).toBe('In attesa');
  });

  it('returns English booking status labels', () => {
    const t = i18n.getFixedT('en');
    expect(getBookingStatusLabel('Confirmed', t)).toBe('Confirmed');
    expect(getOtaConnectionStatusLabel('connected', t)).toBe('Connected');
  });

  it('persists and reads locale from localStorage', () => {
    expect(readPersistedLocale()).toBeNull();

    persistLocale('en');
    expect(readPersistedLocale()).toBe('en');

    persistLocale('it');
    expect(readPersistedLocale()).toBe('it');
  });

  it('getRoleLabel_KnownAndUnknownRole_TranslatesOrKeepsRawValue', () => {
    expect(getRoleLabel('PropertyOwner', i18n.getFixedT('it'))).toBe('Proprietario');
    expect(getRoleLabel('PropertyOwner', i18n.getFixedT('en'))).toBe('Owner');
    expect(getRoleLabel('SomethingNew', i18n.getFixedT('it'))).toBe('SomethingNew');
  });

  it('getServiceCategoryLabel_FreeTextCategory_ShowsValueNotRawKey', () => {
    expect(getServiceCategoryLabel('cleaning', i18n.getFixedT('it'))).toBe('Pulizie');
    expect(getServiceCategoryLabel('Giardinaggio', i18n.getFixedT('en'))).toBe('Giardinaggio');
  });

  it('getRentalTypeLabel_EnglishLocale_ReturnsEnglishLabel', () => {
    expect(getRentalTypeLabel('LongTerm', i18n.getFixedT('it'))).toBe('Locazioni di lungo periodo');
    expect(getRentalTypeLabel('LongTerm', i18n.getFixedT('en'))).not.toBe('Locazioni di lungo periodo');
    expect(getPlanTierLabel('Pro', i18n.getFixedT('en'))).toBe('Pro');
  });
});

describe('locale files', () => {
  it('hasKey_ObjectTranslations_RecognisesParentsWithoutMatchingPartialNames', () => {
    const keys = flatten({ guide: { sections: { intro: 'Welcome' } } });
    expect(hasKey(keys, 'guide.sections')).toBe(true);
    expect(hasKey(keys, 'guide.section')).toBe(false);
    expect(hasKey(keys, 'guide.missing')).toBe(false);
  });

  it('localeFiles_ItAndEn_HaveTheSameKeys', () => {
    const missingInEn = [...itKeys.keys()].filter((k) => !enKeys.has(k));
    const missingInIt = [...enKeys.keys()].filter((k) => !itKeys.has(k));
    expect(missingInEn, 'keys present in it.json but missing in en.json').toEqual([]);
    expect(missingInIt, 'keys present in en.json but missing in it.json').toEqual([]);
  });

  it('localeFiles_SameKey_UsesTheSamePlaceholdersInBothLanguages', () => {
    const mismatches = [...itKeys.entries()]
      .filter(([key]) => enKeys.has(key))
      .filter(([key, value]) => placeholders(value).join() !== placeholders(enKeys.get(key)!).join())
      .map(([key]) => key);
    expect(mismatches).toEqual([]);
  });

  it('localeFiles_Values_HaveNoEmptyStringsOrSingleBracePlaceholders', () => {
    // `{name}` is not interpolated by i18next (it needs `{{name}}`); `/book/{slug}` style
    // patterns shown literally to the user are allowed.
    const literalPatterns = new Set(['domain.modes.path', 'domain.modes.subdomain']);
    for (const keys of [itKeys, enKeys]) {
      const bad = [...keys.entries()]
        .filter(([key, value]) => {
          const text = Array.isArray(value) ? value.join('\n') : value;
          if (text.trim() === '') return true;
          return !literalPatterns.has(key) && /(?<!\{)\{\w+\}(?!\})/.test(text);
        })
        .map(([key]) => key);
      expect(bad).toEqual([]);
    }
  });

  it('localeFiles_PluralKeys_DefineOneAndOtherForms', () => {
    for (const keys of [itKeys, enKeys]) {
      const bases = new Set([...keys.keys()].filter((k) => PLURAL_SUFFIX.test(k)).map((k) => k.replace(PLURAL_SUFFIX, '')));
      const incomplete = [...bases].filter((base) => !keys.has(`${base}_one`) || !keys.has(`${base}_other`));
      expect(incomplete).toEqual([]);
    }
  });

  it('localeFiles_Values_NeverBuildPluralsWithSuffixVariables', () => {
    // "notte{{plural}}" produced "3 nottei" / "3 nighti" (R-08): plurals use _one/_other keys.
    const manual = [...itKeys.entries(), ...enKeys.entries()]
      .filter(([, value]) => /\{\{\s*plural\s*\}\}/.test(Array.isArray(value) ? value.join() : value))
      .map(([key]) => key);
    expect(manual).toEqual([]);
  });
});

describe('keys used in code', () => {
  const used = collectUsedKeys();

  it('collectUsedKeys_Sources_FindsStaticKeys', () => {
    // Guard against a broken scanner silently passing the next test.
    expect(Object.keys(SOURCES).length).toBeGreaterThan(100);
    expect(used.size).toBeGreaterThan(1000);
    expect(used.has('property.validation.name.minLength')).toBe(true);
  });

  it('staticKeys_UsedInCode_ExistInItAndEn', () => {
    const missing = [...used.entries()]
      .filter(([key]) => !hasKey(itKeys, key) || !hasKey(enKeys, key))
      .map(([key, file]) => `${key} (${file}): it=${hasKey(itKeys, key)} en=${hasKey(enKeys, key)}`);
    expect(missing).toEqual([]);
  });

  it('enumLabels_ValuesShownToUsers_HaveKeysInBothLocales', () => {
    const expected = [
      ...COMMON_AMENITIES.map((a) => `amenity.${a}`),
      // The explained states (UI-11): every state of the dictionary, typed against the enums, has its name and its sentence in both
      // languages, and its list of what is needed when it has a way forward (status.<kind>.<key>.*).
      ...Object.entries(STATUS_DICTIONARY).flatMap(([kind, states]) =>
        Object.entries(states as Record<string, StatusDefinition>).flatMap(([status, definition]) => [
          `status.${kind}.${status}.label`,
          `status.${kind}.${status}.explain`,
          ...(definition.need ? [`status.${kind}.${status}.need`] : []),
          ...(definition.supplier ? [`status.${kind}.${status}.supplier.explain`] : []),
        ]),
      ),
      ...['Admin', 'PropertyOwner', 'LongTermLandlord', 'Supplier', 'PropertyManager', 'Guest', 'Staff', 'None'].map(
        (r) => `roles.${r}`,
      ),
      ...['Starter', 'Pro', 'Scale'].map((p) => `plan.tier.${p}`),
      ...['Richiesto', 'PresoInCarico', 'InCorso', 'Completato', 'Pagato', 'Rifiutato', 'Annullato'].map((s) => `serviceRequest.status.${s}`),
      // Codes of GET /api/service-categories (backend ServiceCategories.All, SU-03).
      ...['cleaning', 'maintenance', 'plumbing', 'laundry', 'linen', 'check-in', 'gardening', 'events', 'rental', 'excursions'].map(
        (c) => `serviceRequest.categories.${c}`,
      ),
      ...['Inviato', 'InCompilazione', 'Completo', 'AlloggiatiInviato', 'Scaduto'].map((s) => `checkin.status.${s}`),
      ...['DaInviare', 'DaInviareManualmente', 'InviatoManualmente', 'Inviato', 'Rifiutato', 'Errore'].map(
        (s) => `alloggiati.statusLabel.${s}`,
      ),
      ...['Errore', 'Rifiutato'].map((s) => `alloggiati.failureNotice.${s}`),
      ...['SingleGuest', 'HeadOfFamily', 'HeadOfGroup', 'FamilyMember', 'GroupMember'].map((k) => `alloggiati.guestKind.${k}`),
      ...['SingleGuest', 'HeadOfFamily', 'HeadOfGroup'].map((k) => `checkin.stayKind.${k}`),
      ...['Comuni', 'Stati', 'Documenti', 'TipiAlloggiato'].map((k) => `alloggiati.codeTable.${k}`),
      ...['member_without_head', 'head_without_members', 'invalid_type'].map((k) => `alloggiati.guestSummary.compositionIssue.${k}`),
      ...[
        'type',
        'arrivalDate',
        'stayDays',
        'lastName',
        'firstName',
        'gender',
        'dateOfBirth',
        'bornInItaly',
        'birthComune',
        'birthProvince',
        'birthCountry',
        'citizenship',
        'documentType',
        'documentNumber',
        'documentIssuePlace',
      ].map((f) => `alloggiati.recordField.${f}`),
      'alloggiati.sentOn',
      'alloggiati.markedSentOn',
      'alloggiati.ordinaryTerm',
      'alloggiati.shortStayTerm',
      ...['Pending', 'Active', 'Suspended'].map((s) => `supplier.statusLabel.${s}`),
      ...['Pending', 'Active', 'Suspended'].map((s) => `compliance.status.${s}`),
      ...['Landlord', 'Tenant'].map((r) => `leases.partyRole.${r}`),
      ...LEASE_STATUSES.map((s) => `leases.statusLabel.${s}`),
      ...LEASE_EVENT_TYPES.map((e) => `leases.eventType.${e}`),
      ...['base-data', 'cin', 'documents', 'safety', 'tourist-tax', 'ical'].map((s) => `compliance.activation.steps.${s}`),
      // D.L. 145/2023 safety checklist (CO-07): items, facts and stable codes of the API.
      ...SAFETY_ITEM_CODES.flatMap((c) => [`compliance.safety.items.${c}.title`, `compliance.safety.items.${c}.reference`]),
      ...SAFETY_ITEM_CODES.filter((c) => c !== 'EmergencyInstructions').map((c) => `compliance.safety.items.${c}.dateLabel`),
      ...COMBUSTION_APPLIANCES.map((a) => `compliance.safety.appliance.${a}`),
      ...SAFETY_DETECTOR_TYPES.map((d) => `compliance.safety.detectorType.${d}`),
      ...['Required', 'Optional', 'NotApplicable', 'Undetermined'].map((r) => `compliance.safety.requirement.${r}`),
      ...['NoGasNoCombustion', 'NotEntrepreneurial'].map((r) => `compliance.safety.notApplicable.${r}`),
      ...[
        'safety_entrepreneurial_unanswered',
        'safety_gas_unanswered',
        'safety_floors_unanswered',
        'safety_extinguishers_missing',
        'safety_extinguishers_below_minimum',
        'safety_extinguishers_review',
        'safety_gas_detector_missing',
        'safety_co_detector_missing',
        'safety_systems_compliance_missing',
        'safety_systems_compliance_review',
        'safety_bdsr_declaration_missing',
        'safety_confirmation_missing',
      ].map((code) => `compliance.safety.blockers.${code}`),
      'compliance.safety.warnings.safety_floor_areas_missing',
    ];
    const missing = expected.filter((key) => !itKeys.has(key) || !enKeys.has(key));
    expect(missing).toEqual([]);
  });
});

describe('plurals', () => {
  it('nightsBreakdown_OneAndManyNights_UsesGrammaticalPlural', () => {
    const tIt = i18n.getFixedT('it');
    const tEn = i18n.getFixedT('en');
    expect(tIt('publicBooking.nightsBreakdown', { count: 1, rate: '120 €' })).toBe('1 notte x 120 €');
    expect(tIt('publicBooking.nightsBreakdown', { count: 3, rate: '120 €' })).toBe('3 notti x 120 €');
    expect(tEn('publicBooking.nightsBreakdown', { count: 1, rate: '€120' })).toBe('1 night x €120');
    expect(tEn('publicBooking.nightsBreakdown', { count: 3, rate: '€120' })).toBe('3 nights x €120');
  });

  it('guestsCount_OneAndManyGuests_IsNotBuiltWithSuffix', () => {
    expect(i18n.getFixedT('it')('publicBooking.guestBookings.guestsCount', { count: 1 })).toBe('1 ospite');
    expect(i18n.getFixedT('it')('publicBooking.guestBookings.guestsCount', { count: 2 })).toBe('2 ospiti');
    expect(i18n.getFixedT('en')('publicBooking.guestBookings.guestsCount', { count: 1 })).toBe('1 guest');
  });
});

describe('zod error map', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
  });

  it('schemaMessage_ZodV4_KeepsTheI18nKeyAsMessage', () => {
    // Zod v4 gives the schema message precedence over the global error map: the key must
    // reach the form untouched, and FormFieldError translates it.
    const result = z.string().min(3, 'property.validation.name.minLength').safeParse('ab');
    expect(result.success).toBe(false);
    expect(result.error!.issues[0].message).toBe('property.validation.name.minLength');
  });

  it('checkWithoutMessage_ItalianLocale_ReturnsTranslatedGenericMessage', () => {
    const tooLong = z.string().max(3).safeParse('abcd');
    expect(tooLong.error!.issues[0].message).toBe('Inserisci al massimo 3 caratteri');

    const notANumber = z.number().safeParse(Number.NaN);
    expect(notANumber.error!.issues[0].message).toBe('Campo obbligatorio');

    const email = z.string().email().safeParse('nope');
    expect(email.error!.issues[0].message).toBe('Indirizzo email non valido');
  });

  it('checkWithoutMessage_EnglishLocale_ReturnsEnglishGenericMessage', async () => {
    await i18n.changeLanguage('en');
    const tooSmall = z.number().min(2).safeParse(1);
    expect(tooSmall.error!.issues[0].message).toBe('The value must be at least 2');
  });
});

/**
 * The guest check-in page in five languages (NF-40, AC-NF40-4). Italian and English are in the app; German, French and Spanish are three
 * subset files that hold only the keys of the `checkin` namespace the page uses and are loaded when the guest chooses them. The keys of the
 * namespace that are not the page's are the host side (the link panel, the wizard) and the ones nothing uses any more.
 */
describe('guest check-in locales', () => {
  const NOT_ON_THE_GUEST_PAGE_EXACT = new Set([
    'copyLink', 'linkCopied', 'generateError', 'resendLink', 'resendError', 'sessionLabel', 'sessionLoading', 'saveData', 'checkInComplete',
    'personalData', 'personalDataDescription', 'document', 'documentIdentity', 'documentHint', 'documentAlreadyUploaded', 'selectFile',
    'uploading', 'unsupportedFormat', 'fileTooLarge', 'birthPlace', 'nationality', 'documentExpiry', 'documentIssuingCountry', 'address',
    'city', 'postalCode', 'country', 'stepPersonal', 'marketingConsent', 'validation.documentNumber.maxLength',
  ]);
  const NOT_ON_THE_GUEST_PAGE_PREFIXES = [
    'access.', 'link.', 'status.', 'biometric.', 'wizard.',
    'validation.placeOfBirth.', 'validation.nationality.', 'validation.documentIssuingCountry.',
  ];

  /** The keys of the `checkin` namespace of en.json that the guest page uses (they carry the `checkin.` prefix). */
  const guestPageKeys = [...enKeys.keys()].filter((key) => {
    if (!key.startsWith('checkin.')) return false;
    const local = key.slice('checkin.'.length);
    return !NOT_ON_THE_GUEST_PAGE_EXACT.has(local) && !NOT_ON_THE_GUEST_PAGE_PREFIXES.some((prefix) => local.startsWith(prefix));
  });

  const SUBSETS = [
    ['de', guestDe],
    ['fr', guestFr],
    ['es', guestEs],
  ] as const;

  it('guestCheckinLocales_PageKeys_AreTheNamespaceOfEnglishWithoutTheHostSide', () => {
    // Guard against a list that silently selects nothing.
    expect(guestPageKeys.length).toBeGreaterThan(100);
    expect(guestPageKeys).toContain('checkin.next');
    expect(guestPageKeys).toContain('checkin.language.label');
    expect(guestPageKeys).not.toContain('checkin.link.copyTitle');
    expect(guestPageKeys.some((key) => key.startsWith('checkin.wizard.'))).toBe(false);
  });

  it.each(SUBSETS)('guestCheckinLocales_%s_HasExactlyTheKeysOfThePage', (_language, bundle) => {
    const keys = flatten(bundle as LocaleTree);
    const missing = guestPageKeys.filter((key) => !keys.has(key));
    const extra = [...keys.keys()].filter((key) => !guestPageKeys.includes(key));

    expect(missing, 'keys of the page missing from the subset file').toEqual([]);
    expect(extra, 'keys of the subset file that are not keys of the page').toEqual([]);
  });

  it.each(SUBSETS)('guestCheckinLocales_%s_OnlyTheCheckinNamespace_NoEmptyTextsSamePlaceholdersAsEnglish', (_language, bundle) => {
    expect(Object.keys(bundle)).toEqual(['checkin']);
    const keys = flatten(bundle as LocaleTree);
    const empty = [...keys.entries()].filter(([, value]) => String(value).trim() === '').map(([key]) => key);
    const mismatched = [...keys.entries()]
      .filter(([key]) => enKeys.has(key))
      .filter(([key, value]) => placeholders(value).join() !== placeholders(enKeys.get(key)!).join())
      .map(([key]) => key);

    expect(empty).toEqual([]);
    expect(mismatched).toEqual([]);
  });

  it('guestCheckinLocales_StaticKeysOfThePageSources_AreKeysOfThePageAndExistInItAndEn', () => {
    const pageSources = import.meta.glob<string>(
      ['/src/features/checkin/*.tsx', '/src/features/checkin/{components,schemas,lib}/*.{ts,tsx}'],
      { query: '?raw', import: 'default', eager: true },
    );
    const used = [...collectUsedKeys(pageSources).keys()].filter((key) => key.startsWith('checkin.'));

    expect(used.length).toBeGreaterThan(40);
    // A key the page uses is in the subset files too, or a German guest reads English where the page has a German text.
    expect(used.filter((key) => !guestPageKeys.some((candidate) => candidate === key || candidate === `${key}_other`))).toEqual([]);
    expect(used.filter((key) => !hasKey(itKeys, key) || !hasKey(enKeys, key))).toEqual([]);
  });

  it('guestCheckinLocales_KeysWrittenOutInTheCode_ExistInItAndEn', () => {
    const keys = [
      ...GUEST_LOCALE_OPTIONS.map((option) => option.nameKey),
      ...Object.values(GUEST_ERROR_KEYS),
      ...Object.values(STATISTICAL_FIELD_OPTIONS).flatMap((options) => options.map((option) => option.labelKey)),
      ...['tourismType', 'travelWay', 'educationLevel'].flatMap((field) => [`checkin.${field}.label`, `checkin.validation.${field}.required`]),
      ...['SingleGuest', 'HeadOfFamily', 'HeadOfGroup', 'FamilyMember', 'GroupMember'].map((kind) => `checkin.guestKind.${kind}`),
      ...Object.values(ISSUE_FIELD_LABEL_KEYS),
      ...Object.values(ISSUE_TEXT_KEYS),
      ...CHECKIN_WIZARD_STEPS.flatMap((step) => ['label', 'title', 'purpose', 'help'].map((part) => `checkin.wizard.steps.${step}.${part}`)),
      ...['resident', 'health_care', 'disability_companion', 'public_service', 'host_family', 'other'].map((code) => `touristTax.exemption.${code}`),
    ];

    expect(keys.filter((key) => !hasKey(itKeys, key) || !hasKey(enKeys, key))).toEqual([]);
    // The messages of the server the page can translate are in the subset files too.
    expect(Object.values(GUEST_ERROR_KEYS).filter((key) => !guestPageKeys.includes(key))).toEqual([]);
  });

  it('guestCheckinLocales_NewKeys_FollowTheConventionAndNeverUseDefaultValue', () => {
    const newKeys = guestPageKeys.filter((key) =>
      /^checkin\.(errors|language|residence|toast|tourismType|travelWay|educationLevel|guestKind)\./.test(key),
    );

    expect(newKeys.length).toBeGreaterThan(40);
    for (const key of newKeys) expect(key).toMatch(/^checkin\.[a-zA-Z]+\.[\w.]+$/);
    const sources = import.meta.glob<string>(['/src/features/checkin/**/*.{ts,tsx}', '!/src/features/checkin/**/__tests__/**'], {
      query: '?raw',
      import: 'default',
      eager: true,
    });
    expect(Object.values(sources).some((source) => /\bdefaultValue\b/.test(source))).toBe(false);
  });

  it('fallbackChain_GermanFrenchAndSpanish_FallBackToEnglishThenItalian', () => {
    expect(i18n.options.fallbackLng).toEqual({ default: ['it'], de: ['en', 'it'], fr: ['en', 'it'], es: ['en', 'it'] });
  });
});
