import { describe, expect, it } from 'vitest';
import i18n from '@/i18n/config';
import { formatPrice, formatPriceAmount, formatPriceShort } from '../stay-format';

/**
 * The price of a night or of a stay as every card, pin, chip, calendar and booking card of the public site writes it (CHF-MONEY): in the currency
 * of the data, with the cents only when there are some. Money rule: with no usable currency nothing is guessed and nothing throws (the amount has no
 * symbol and the phrase says the currency is not available), and a valid currency is written exactly as it always was.
 */
const italian = i18n.getFixedT('it');
const english = i18n.getFixedT('en');

describe('formatPrice', () => {
  it('FormatPrice_WholeAmountOfAValidCurrency_HasNoCentsAndOneOfTheCentsKeepsThem', () => {
    const whole = (locale: string, currency: string, amount: number) =>
      new Intl.NumberFormat(locale, { style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
    const cents = (locale: string, currency: string, amount: number) =>
      new Intl.NumberFormat(locale, { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);

    expect(formatPrice(16500, 'EUR', 'it-IT', italian)).toBe(whole('it-IT', 'EUR', 165));
    expect(formatPrice(16550, 'EUR', 'it-IT', italian)).toBe(cents('it-IT', 'EUR', 165.5));
    expect(formatPrice(16500, 'EUR', 'en-GB', english)).toBe(whole('en-GB', 'EUR', 165));
  });

  it('FormatPrice_StayInSwissFrancs_IsWrittenInFrancsAndNotInEuros', () => {
    const franc = formatPrice(36000, 'CHF', 'en-GB', english);

    expect(franc).toContain('CHF');
    expect(franc).not.toContain('€');
    expect(franc).not.toContain('currency not available');
  });

  it.each([
    ['empty', ''],
    ['undefined', undefined],
    ['null', null],
    ['not a code (XX1)', 'XX1'],
  ] as const)('FormatPrice_Currency%s_WritesTheAmountWithNoSymbolAndSaysTheCurrencyIsNotAvailable', (_name, currency) => {
    // The same rule of the cents: whole amounts have none, the others keep two.
    expect(formatPrice(16500, currency, 'it-IT', italian)).toBe('165 (valuta non disponibile)');
    expect(formatPrice(16550, currency, 'it-IT', italian)).toBe('165,50 (valuta non disponibile)');
    expect(formatPrice(16500, currency, 'en-GB', english)).toBe('165 (currency not available)');
    expect(formatPrice(16550, currency, 'en-GB', english)).toBe('165.50 (currency not available)');
  });
});

describe('formatPriceAmount', () => {
  it('FormatPriceAmount_Cents_IsTheNumberAloneWithTheRuleOfTheCents', () => {
    expect(formatPriceAmount(16500, 'it-IT')).toBe('165');
    expect(formatPriceAmount(16550, 'it-IT')).toBe('165,50');
    expect(formatPriceAmount(16500, 'en-GB')).toBe('165');
    expect(formatPriceAmount(16550, 'en-GB')).toBe('165.50');
  });
});

describe('formatPriceShort', () => {
  it('FormatPriceShort_CurrencyOfTheData_IsWrittenExactlyAsFormatPrice', () => {
    expect(formatPriceShort(16500, 'EUR', 'it-IT', italian)).toBe(formatPrice(16500, 'EUR', 'it-IT', italian));
    expect(formatPriceShort(16550, 'EUR', 'en-GB', english)).toBe(formatPrice(16550, 'EUR', 'en-GB', english));
    const franc = formatPriceShort(36000, 'CHF', 'en-GB', english);
    expect(franc).toBe(formatPrice(36000, 'CHF', 'en-GB', english));
    expect(franc).toContain('CHF');
  });

  it.each([
    ['empty', ''],
    ['undefined', undefined],
    ['null', null],
    ['not a code (XX1)', 'XX1'],
  ] as const)('FormatPriceShort_Currency%s_IsTheNumberAloneWithNoSymbolAndNoPhrase', (_name, currency) => {
    // For a place with no room for the phrase (a cell of the calendar): the phrase is said where there is room, by `formatPrice`.
    expect(formatPriceShort(16500, currency, 'it-IT', italian)).toBe('165');
    expect(formatPriceShort(16550, currency, 'it-IT', italian)).toBe('165,50');
    expect(formatPriceShort(16500, currency, 'en-GB', english)).toBe('165');
    expect(formatPriceShort(16550, currency, 'en-GB', english)).toBe('165.50');
  });
});
