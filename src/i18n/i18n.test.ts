import { describe, expect, it, beforeEach } from 'vitest';
import { z } from 'zod';
import i18n from '@/i18n/config';
import it_ from '@/i18n/locales/it.json';
import en from '@/i18n/locales/en.json';
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

/** True when `key` resolves in the locale, directly or through its plural forms (`key_one`, `key_other`). */
function hasKey(keys: Map<string, unknown>, key: string): boolean {
  return keys.has(key) || keys.has(`${key}_other`);
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
function collectUsedKeys(): Map<string, string> {
  const used = new Map<string, string>();
  const namespaces = Object.keys(it_);
  const keyShape = /^[a-zA-Z][\w-]*(\.[\w-]+)+$/;
  const add = (key: string, file: string) => {
    if (keyShape.test(key)) used.set(key, file);
  };

  for (const [file, source] of Object.entries(SOURCES)) {
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
      ...['Admin', 'PropertyOwner', 'LongTermLandlord', 'Supplier', 'PropertyManager', 'Guest', 'Staff'].map((r) => `roles.${r}`),
      ...['Starter', 'Pro', 'Scale'].map((p) => `plan.tier.${p}`),
      ...['Richiesto', 'PresoInCarico', 'InCorso', 'Completato', 'Pagato', 'Rifiutato'].map((s) => `serviceRequest.status.${s}`),
      // Codes of GET /api/service-categories (backend ServiceCategories.All, SU-03).
      ...['cleaning', 'maintenance', 'plumbing', 'laundry', 'linen', 'check-in', 'gardening', 'events', 'rental', 'excursions'].map(
        (c) => `serviceRequest.categories.${c}`,
      ),
      ...['Inviato', 'InCompilazione', 'Completo', 'AlloggiatiInviato', 'Scaduto'].map((s) => `checkin.status.${s}`),
      ...['DaInviare', 'DaInviareManualmente', 'InviatoManualmente', 'Inviato', 'Rifiutato', 'Errore'].map(
        (s) => `alloggiati.statusLabel.${s}`,
      ),
      ...['Errore', 'Rifiutato'].map((s) => `alloggiati.failureNotice.${s}`),
      ...['SingleGuest', 'HeadOfFamilyOrGroup'].map((k) => `alloggiati.guestKind.${k}`),
      ...[
        'kind',
        'arrivalDate',
        'stayDays',
        'lastName',
        'firstName',
        'gender',
        'dateOfBirth',
        'placeOfBirth',
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
      ...['base-data', 'cin', 'documents', 'safety', 'tourist-tax', 'ical'].map((s) => `compliance.activation.steps.${s}`),
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

  it('bookingsCount_SingleBooking_IsNotBuiltWithSuffix', () => {
    expect(i18n.getFixedT('it')('publicBooking.bookingsCount', { count: 1 })).toBe('Trovata 1 prenotazione');
    expect(i18n.getFixedT('it')('publicBooking.bookingsCount', { count: 2 })).toBe('Trovate 2 prenotazioni');
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
