import { beforeEach, describe, expect, it } from 'vitest';
import i18n from '@/i18n/config';
import it_ from '@/i18n/locales/it.json';
import en from '@/i18n/locales/en.json';
import {
  SUPPLIER_SERVICE_PRICE_UNITS,
  SUPPLIER_SERVICE_STATUSES,
  SUPPLIER_SERVICE_WEEKDAYS,
  SUPPLIER_SUPPLEMENT_UNITS,
} from '@/types/supplier-services';
import { formatDuration, formatNotice, formatPrice, priceUnitLabel, supplementUnitLabel, weekdayShort } from '../service-labels';
import { DURATION_CHOICES, NOTICE_CHOICES } from '../service-limits';

type Tree = { [key: string]: string | Tree };
const NORMAL_SPACE = (text: string) => text.replace(/\s/g, ' ');

function lookup(tree: Tree, path: string): unknown {
  return path.split('.').reduce<unknown>((node, part) => (node && typeof node === 'object' ? (node as Tree)[part] : undefined), tree);
}

describe('the texts of the catalog', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
  });

  it('FormatPrice_FixedPrice_IsFromTheAmountAndTheUnit', () => {
    expect(NORMAL_SPACE(formatPrice({ requiresQuote: false, priceFromCents: 4500, priceUnit: 'PerJob' }, i18n.t, 'it'))).toBe('da 45 € a intervento');
    expect(NORMAL_SPACE(formatPrice({ requiresQuote: false, priceFromCents: 1850, priceUnit: 'PerHour' }, i18n.t, 'it'))).toBe('da 18,50 € all’ora');
    expect(NORMAL_SPACE(formatPrice({ requiresQuote: false, priceFromCents: 3000, priceUnit: 'PerSquareMeter' }, i18n.t, 'it'))).toBe('da 30 € al m²');
  });

  it('FormatPrice_OnQuote_SaysSoWhateverElseThePriceCarries', () => {
    expect(formatPrice({ requiresQuote: true, priceFromCents: null, priceUnit: 'PerJob' }, i18n.t, 'it')).toBe('Su preventivo');
    expect(formatPrice({ requiresQuote: true, priceFromCents: 5000, priceUnit: 'PerHour' }, i18n.t, 'it')).toBe('Su preventivo');
  });

  it('FormatPrice_NotSetYet_SaysItIsToBeSetAndNeverZero', () => {
    expect(formatPrice({ requiresQuote: false, priceFromCents: null, priceUnit: 'PerJob' }, i18n.t, 'it')).toBe('Prezzo da indicare');
  });

  it('FormatPrice_English_IsInEnglish', async () => {
    await i18n.changeLanguage('en');
    expect(formatPrice({ requiresQuote: false, priceFromCents: 4550, priceUnit: 'PerSet' }, i18n.t, 'en')).toBe('from €45.50 per set');
    expect(formatPrice({ requiresQuote: true, priceFromCents: null, priceUnit: 'PerJob' }, i18n.t, 'en')).toBe('On quote');
  });

  it.each([
    [null, 'Durata da indicare'],
    [30, '30 min'],
    [60, '1 h'],
    [90, '1 h 30 min'],
    [120, '2 h'],
    [480, '8 h'],
    [5, '5 min'],
    [1440, '24 h'],
  ])('FormatDuration_%s_Is%s', (minutes, text) => {
    expect(formatDuration(minutes, i18n.t)).toBe(text);
  });

  it.each([
    [null, 'Quello delle regole di disponibilità'],
    [0, 'Nessun preavviso'],
    [1, '1 ora'],
    [4, '4 ore'],
    [12, '12 ore'],
    [24, '1 giorno'],
    [48, '2 giorni'],
    [168, '7 giorni'],
    [30, '30 ore'],
  ])('FormatNotice_%s_Is%s', (hours, text) => {
    expect(formatNotice(hours, i18n.t)).toBe(text);
  });

  it('FormatNotice_English_UsesThePluralOfTheLanguage', async () => {
    await i18n.changeLanguage('en');
    expect(formatNotice(1, i18n.t)).toBe('1 hour');
    expect(formatNotice(2, i18n.t)).toBe('2 hours');
    expect(formatNotice(24, i18n.t)).toBe('1 day');
    expect(formatNotice(72, i18n.t)).toBe('3 days');
  });

  it('WeekdayShort_TheSevenDays_AreInTheLanguageOfThePage', () => {
    expect(SUPPLIER_SERVICE_WEEKDAYS.map((day) => weekdayShort(day, 'it').toLowerCase().replace('.', ''))).toEqual(['lun', 'mar', 'mer', 'gio', 'ven', 'sab', 'dom']);
    expect(SUPPLIER_SERVICE_WEEKDAYS.map((day) => weekdayShort(day, 'en'))).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
  });

  it('PriceUnitLabel_EveryUnitOfTheApi_HasAWordInBothLanguages', () => {
    for (const unit of SUPPLIER_SERVICE_PRICE_UNITS) {
      expect(lookup(it_ as unknown as Tree, `supplier.services.units.${unit}`), unit).toEqual(expect.any(String));
      expect(lookup(en as unknown as Tree, `supplier.services.units.${unit}`), unit).toEqual(expect.any(String));
      expect(priceUnitLabel(unit, i18n.t)).not.toContain('supplier.services');
    }
  });

  it('SupplementUnitLabel_EveryUnitOfTheApi_HasAWordInBothLanguages', () => {
    for (const unit of SUPPLIER_SUPPLEMENT_UNITS) {
      expect(lookup(it_ as unknown as Tree, `supplier.services.supplementUnits.${unit}`), unit).toEqual(expect.any(String));
      expect(lookup(en as unknown as Tree, `supplier.services.supplementUnits.${unit}`), unit).toEqual(expect.any(String));
      expect(supplementUnitLabel(unit, i18n.t)).not.toContain('supplier.services');
    }
  });

  it('TheChoicesOfTheForm_AreInRangeOfTheApi', () => {
    // 5 to 1,440 minutes; 0 to 720 hours of notice.
    for (const minutes of DURATION_CHOICES) {
      expect(minutes).toBeGreaterThanOrEqual(5);
      expect(minutes).toBeLessThanOrEqual(1440);
    }
    for (const hours of NOTICE_CHOICES) {
      if (hours !== null) expect(hours).toBeGreaterThanOrEqual(0);
      if (hours !== null) expect(hours).toBeLessThanOrEqual(720);
    }
    expect([...DURATION_CHOICES].sort((a, b) => a - b)).toEqual([...DURATION_CHOICES]);
  });

  it('TheTextsOfEveryState_StepAndSection_ExistInBothLanguages', () => {
    const needed = [
      ...SUPPLIER_SERVICE_STATUSES.flatMap((status) => [
        `supplier.services.detail.visible.${status}`,
        `supplier.services.filters.${status}`,
        `status.serviceListing.${status}.label`,
        `status.serviceListing.${status}.explain`,
      ]),
      ...['service', 'price', 'booking', 'photos'].flatMap((step) => [
        `supplier.services.wizard.steps.${step}.label`,
        `supplier.services.wizard.steps.${step}.title`,
        `supplier.services.wizard.steps.${step}.purpose`,
        `supplier.services.empty.steps.${step}`,
      ]),
      ...['fixed', 'hourly', 'quote'].flatMap((mode) => [`supplier.services.form.price.modes.${mode}.title`, `supplier.services.form.price.modes.${mode}.description`]),
      ...['category', 'description', 'duration', 'excluded', 'included', 'name', 'notice', 'photos', 'price', 'summary', 'supplements', 'weekdays'].map((field) => `supplier.services.fields.${field}`),
      ...SUPPLIER_SERVICE_WEEKDAYS.map((day) => `supplier.weekday.${day}`),
      'nav.supplierServices',
      'commandPalette.keywords.supplierServices',
    ];
    const missing = needed.filter((key) => lookup(it_ as unknown as Tree, key) === undefined || lookup(en as unknown as Tree, key) === undefined);
    expect(missing).toEqual([]);
  });

  it('TheNamespaceOfTheCatalog_IsInAlphabeticalOrder', () => {
    const walk = (node: unknown, path: string): string[] => {
      if (!node || typeof node !== 'object') return [];
      const keys = Object.keys(node);
      const sorted = [...keys].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()) || (a < b ? -1 : 1));
      const here = keys.join() === sorted.join() ? [] : [`${path}: ${keys.join(',')}`];
      return [...here, ...keys.flatMap((key) => walk((node as Tree)[key], `${path}.${key}`))];
    };
    expect(walk(lookup(it_ as unknown as Tree, 'supplier.services'), 'supplier.services')).toEqual([]);
    expect(walk(lookup(en as unknown as Tree, 'supplier.services'), 'supplier.services')).toEqual([]);
  });
});
