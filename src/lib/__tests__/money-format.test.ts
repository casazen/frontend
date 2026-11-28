import { describe, expect, it } from 'vitest';
import i18n from '@/i18n/config';
import { currencyCodeOf, formatAmount, formatMoney } from '../money-format';

/**
 * The currency comes only from the data (CHF-MONEY): a stay priced in francs never shows a euro, and a stay whose data says no currency never gets one invented.
 * Money rule, so these are the proofs: a code that is not one never makes `Intl` throw (a render that throws blanks the page), and what is written then is
 * the amount with no symbol and the phrase that says the currency is not available, in the language of the page.
 */
const italian = i18n.getFixedT('it');
const english = i18n.getFixedT('en');

/** What the data may carry instead of a currency: nothing, an empty text, blanks, and texts that are not an ISO 4217 code. */
const NO_USABLE_CURRENCY: ReadonlyArray<readonly [string, string | null | undefined]> = [
  ['undefined', undefined],
  ['null', null],
  ['an empty code', ''],
  ['blanks', '   '],
  ['a code with a digit', 'XX1'],
  ['a word', 'EURO'],
  ['two letters', 'EU'],
  ['a symbol', '€'],
];

const ANY_CURRENCY = /[€$£¤]|EUR|CHF|USD|GBP/;

describe('currencyCodeOf', () => {
  it('CurrencyCodeOf_ThreeLetters_IsTheCodeInUpperCase', () => {
    expect(currencyCodeOf('EUR')).toBe('EUR');
    expect(currencyCodeOf('chf')).toBe('CHF');
    expect(currencyCodeOf(' usd ')).toBe('USD');
  });

  it.each(NO_USABLE_CURRENCY)('CurrencyCodeOf_%s_IsNoCurrencyAndNothingIsGuessed', (_name, value) => {
    expect(currencyCodeOf(value)).toBeNull();
  });
});

describe('formatMoney', () => {
  it('FormatMoney_ValidCurrency_IsWrittenInThatCurrencyAndNothingElseIsAdded', () => {
    const euro = formatMoney(145, 'EUR', 'it-IT', italian);
    expect(euro).toBe(new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(145));
    expect(euro).not.toContain('valuta non disponibile');

    const franc = formatMoney(145, 'CHF', 'en-GB', english);
    expect(franc).toBe(new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'CHF' }).format(145));
    expect(franc).toContain('CHF');
    expect(franc).not.toContain('€');
    expect(franc).not.toContain('currency not available');
  });

  it.each(NO_USABLE_CURRENCY)('FormatMoney_%s_WritesTheAmountWithNoSymbolAndSaysTheCurrencyIsNotAvailable', (_name, currency) => {
    const inItalian = formatMoney(145, currency, 'it-IT', italian);
    const inEnglish = formatMoney(145, currency, 'en-GB', english);

    expect(inItalian).toBe('145,00 (valuta non disponibile)');
    expect(inEnglish).toBe('145.00 (currency not available)');
    expect(inItalian.replace('valuta non disponibile', '')).not.toMatch(ANY_CURRENCY);
    expect(inEnglish.replace('currency not available', '')).not.toMatch(ANY_CURRENCY);
  });

  it('FormatMoney_CodeThatIntlRefuses_NeverThrowsWhereIntlDoes', () => {
    expect(() => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'XX1' })).toThrow(RangeError);
    expect(() => new Intl.NumberFormat('it-IT', { style: 'currency', currency: '' })).toThrow(RangeError);

    expect(() => formatMoney(145, 'XX1', 'it-IT', italian)).not.toThrow();
    expect(() => formatMoney(145, '', 'it-IT', italian)).not.toThrow();
    expect(() => formatMoney(145, undefined, 'en-GB', english)).not.toThrow();
  });

  it('FormatMoney_DigitsAsked_AreKeptWithACurrencyAndWithout', () => {
    const whole = { minimumFractionDigits: 0, maximumFractionDigits: 0 };

    expect(formatMoney(145, 'EUR', 'it-IT', italian, whole)).toBe(
      new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', ...whole }).format(145),
    );
    expect(formatMoney(145, '', 'it-IT', italian, whole)).toBe('145 (valuta non disponibile)');
    expect(formatMoney(145.5, '', 'en-GB', english, { minimumFractionDigits: 2, maximumFractionDigits: 2 })).toBe('145.50 (currency not available)');
  });

  it('FormatMoney_FormatsAreKept_ButACurrencyOfTheDataNeverLeaksIntoAnAmountWithNone', () => {
    expect(formatMoney(145, 'EUR', 'it-IT', italian)).toContain('€');
    expect(formatMoney(145, undefined, 'it-IT', italian)).not.toContain('€');
    expect(formatMoney(145, 'CHF', 'it-IT', italian)).toContain('CHF');
    expect(formatMoney(145, 'CHF', 'it-IT', italian)).not.toContain('€');
    expect(formatMoney(145, '', 'it-IT', italian)).toBe('145,00 (valuta non disponibile)');
    expect(formatAmount(145, 'it-IT')).toBe('145,00');
    expect(formatMoney(145, 'EUR', 'it-IT', italian)).toContain('€');
  });
});

describe('formatAmount', () => {
  it('FormatAmount_Number_IsWrittenAloneInTheLanguageOfThePage', () => {
    expect(formatAmount(145, 'it-IT')).toBe('145,00');
    expect(formatAmount(145, 'en-GB')).toBe('145.00');
    expect(formatAmount(145, 'it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 0 })).toBe('145');
    expect(formatAmount(145.5, 'en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })).toBe('145.50');
  });

  it('FormatAmount_Number_HasNoSymbolNoCodeAndNoPhrase', () => {
    for (const written of [formatAmount(145, 'it-IT'), formatAmount(145, 'en-GB')]) {
      expect(written).not.toMatch(ANY_CURRENCY);
      expect(written).toMatch(/^[\d.,]+$/);
    }
  });
});
