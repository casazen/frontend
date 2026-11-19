import { describe, expect, it } from 'vitest';
import { hasYearEndCurrency, yearEndFallbackName, yearEndMoney, yearEndYears } from '../tourist-tax-year-end-model';

describe('the years of the page of the tourist tax at year end', () => {
  it('YearEndYears_TheCurrentYearAndTheThreeBefore_NewestFirst', () => {
    expect(yearEndYears('2026-09-24')).toEqual([2026, 2025, 2024, 2023]);
    // The year turns on the day of Rome, which `todayInRome` gives: on 1 January it is the new one.
    expect(yearEndYears('2027-01-01')).toEqual([2027, 2026, 2025, 2024]);
  });
});

describe('the name of a file when the page cannot read the one the server gives it', () => {
  it('YearEndFallbackName_IsTheNameTheServerGives_SoTheFileIsNamedTheSameWhetherOrNotTheHeaderIsReadable', () => {
    // The names of `TouristTaxYearEndExports` (backend): the declaration, the account of the agent cut by month or by quarter, and the count of Ticino.
    expect(yearEndFallbackName({ kind: 'declaration', year: 2026, format: 'csv' })).toBe('casazen-imposta-soggiorno-dichiarazione-2026.csv');
    expect(yearEndFallbackName({ kind: 'agentAccount', year: 2026, by: 'month', format: 'xlsx' })).toBe('casazen-imposta-soggiorno-conto-agente-2026-mensile.xlsx');
    expect(yearEndFallbackName({ kind: 'agentAccount', year: 2026, by: 'quarter', format: 'csv' })).toBe('casazen-imposta-soggiorno-conto-agente-2026-trimestrale.csv');
    expect(yearEndFallbackName({ kind: 'ticino', year: 2025, format: 'xlsx' })).toBe('casazen-imposta-soggiorno-ticino-2025.xlsx');
  });
});

/** The space between the figure and the symbol is a no-break one: the texts are compared with a plain one. */
const plain = (text: string) => text.replace(/\s/g, ' ');

describe('the figures of the year', () => {
  it('YearEndMoney_TheCurrencyIsTheOneOfTheAnswer_AndAnAnswerWithNoneIsTheFigureAlone', () => {
    expect(plain(yearEndMoney(1234550, 'EUR', 'it'))).toBe('12.345,50 €');
    expect(plain(yearEndMoney(1234550, 'chf', 'it'))).toBe('12.345,50 CHF');
    expect(plain(yearEndMoney(1234550, 'EUR', 'en'))).toBe('€12,345.50');
    for (const none of ['', '  ', 'EURO', null, undefined]) {
      expect(hasYearEndCurrency(none)).toBe(false);
      expect(plain(yearEndMoney(1234550, none, 'it'))).toBe('12.345,50');
    }
  });
});
