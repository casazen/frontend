import { describe, expect, it } from 'vitest';
import { centsToInput, formatMoney, parseEuros } from '../service-money';

describe('parseEuros', () => {
  it.each([
    ['45', 4500],
    ['45,5', 4550],
    ['45,50', 4550],
    ['45.50', 4550],
    ['45.5', 4550],
    ['0,01', 1],
    ['0.99', 99],
    ['  € 45 ', 4500],
    ['1.234,56', 123456],
    ['1,234.56', 123456],
    ['1.500', 150000],
    ['12.500', 1250000],
    ['1.234.567', 123456700],
    ['45.', 4500],
    ['45,', 4500],
    ['.50', 50],
    [',5', 50],
    // A lone separator followed by exactly three digits (after at most three) groups the thousands, as an Italian writes it.
    ['45,123', 4512300],
  ])('ParseEuros_%s_Is%i cents', (text, cents) => {
    expect(parseEuros(text)).toEqual({ cents, problem: null });
  });

  it('ParseEuros_Blank_IsBlankNotZero', () => {
    for (const text of ['', '   ', '€']) expect(parseEuros(text)).toEqual({ cents: null, problem: 'blank' });
  });

  it.each(['abc', '-5', '4 5 x', '45,555,5a', '1.2345', '4.5.5.x', '--', ',', '.50x', '€€x'])('ParseEuros_%s_IsNotAnAmount', (text) => {
    expect(parseEuros(text).problem).toBe('invalid');
    expect(parseEuros(text).cents).toBeNull();
  });

  it('ParseEuros_MoreThanTwoDecimals_IsNotAnAmountAndNeverRounded', () => {
    // Three digits after a lone separator are thousands only after at most three digits: four digits before make it a decimal part.
    expect(parseEuros('4512,123').problem).toBe('invalid');
    expect(parseEuros('45,1234').problem).toBe('invalid');
  });

  it('ParseEuros_NoFloatInTheWay_KeepsEveryCent', () => {
    // 0.29 * 100 is 28.999999999999996 with floats.
    expect(parseEuros('0,29').cents).toBe(29);
    expect(parseEuros('1,15').cents).toBe(115);
    expect(parseEuros('19,99').cents).toBe(1999);
  });
});

describe('centsToInput', () => {
  it('CentsToInput_WholeAmount_HasNoDecimals', () => {
    expect(centsToInput(4500, ',')).toBe('45');
    expect(centsToInput(100, '.')).toBe('1');
  });

  it('CentsToInput_WithCents_UsesTheDecimalPointOfTheLanguage', () => {
    expect(centsToInput(4550, ',')).toBe('45,50');
    expect(centsToInput(4550, '.')).toBe('45.50');
    expect(centsToInput(5, ',')).toBe('0,05');
    expect(centsToInput(1999, '.')).toBe('19.99');
  });

  it('CentsToInput_NoAmount_IsEmpty', () => {
    expect(centsToInput(null, ',')).toBe('');
    expect(centsToInput(undefined, ',')).toBe('');
  });

  it('CentsToInput_ThenParse_GivesTheSameCents', () => {
    for (const cents of [1, 5, 99, 100, 101, 4550, 123456, 10_000_000]) {
      expect(parseEuros(centsToInput(cents, ',')).cents).toBe(cents);
      expect(parseEuros(centsToInput(cents, '.')).cents).toBe(cents);
    }
  });
});

describe('formatMoney', () => {
  it('FormatMoney_Italian_WritesWholeAmountsWithoutDecimals', () => {
    expect(formatMoney(4500, 'it').replace(/\s/g, ' ')).toBe('45 €');
    expect(formatMoney(4550, 'it').replace(/\s/g, ' ')).toBe('45,50 €');
  });

  it('FormatMoney_English_PutsTheEuroFirst', () => {
    expect(formatMoney(4500, 'en')).toBe('€45');
    expect(formatMoney(4550, 'en')).toBe('€45.50');
  });
});
