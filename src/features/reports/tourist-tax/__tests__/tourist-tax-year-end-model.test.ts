import { describe, expect, it } from 'vitest';
import i18n from '@/i18n/config';
import type { TouristTaxAgentAccountRow } from '@/types';
import {
  accountGroups,
  accountPeriodLabel,
  exemptionReasonLabel,
  hasYearEndCurrency,
  stayReasonLabel,
  yearEndAmount,
  yearEndFallbackName,
  yearEndMoney,
  yearEndYears,
} from '../tourist-tax-year-end-model';

describe('the years of the page of the tourist tax at year end', () => {
  it('YearEndYears_TheCurrentYearAndTheThreeBefore_NewestFirst', () => {
    expect(yearEndYears('2026-09-24')).toEqual([2026, 2025, 2024, 2023]);
    expect(yearEndYears('2027-01-01')).toEqual([2027, 2026, 2025, 2024]);
  });
});

describe('the name of a file when the page cannot read the one the server gives it', () => {
  it('YearEndFallbackName_IsTheNameTheServerGives_SoTheFileIsNamedTheSameWhetherOrNotTheHeaderIsReadable', () => {
    expect(yearEndFallbackName({ kind: 'declaration', year: 2026, format: 'csv' })).toBe('casazen-imposta-soggiorno-dichiarazione-2026.csv');
    expect(yearEndFallbackName({ kind: 'agentAccount', year: 2026, by: 'month', format: 'xlsx' })).toBe('casazen-imposta-soggiorno-conto-agente-2026-mensile.xlsx');
    expect(yearEndFallbackName({ kind: 'agentAccount', year: 2026, by: 'quarter', format: 'csv' })).toBe('casazen-imposta-soggiorno-conto-agente-2026-trimestrale.csv');
    expect(yearEndFallbackName({ kind: 'ticino', year: 2025, format: 'xlsx' })).toBe('casazen-imposta-soggiorno-ticino-2025.xlsx');
  });
});

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

  it('YearEndAmount_TheNumberOfTheServer_IsWrittenInTheCurrencyOfItsAnswer_AndOneWithNoneIsTheFigureAlone', () => {
    expect(plain(yearEndAmount(12345.5, 'CHF', 'it'))).toBe('12.345,50 CHF');
    expect(plain(yearEndAmount(12345.5, 'eur', 'en'))).toBe('€12,345.50');
    expect(plain(yearEndAmount(-0.05, 'EUR', 'it'))).toBe('-0,05 €');
    for (const none of ['', '  ', 'FRANCS', null, undefined]) expect(plain(yearEndAmount(12345.5, none, 'it'))).toBe('12.345,50');
  });
});

const accountRow = (comune: string, period: string): TouristTaxAgentAccountRow => ({
  comune,
  period,
  from: `${period.slice(0, 4)}-01-01`,
  to: `${period.slice(0, 4)}-12-31`,
  isYear: false,
  stays: 0,
  nights: 0,
  guests: 0,
  collected: 0,
  staysWithoutAmount: 0,
  remitted: 0,
  balance: 0,
});

describe('the account of the agent on screen', () => {
  it('AccountGroups_RowsThatFollowOneAnother_GoUnderTheirComune_InTheOrderTheServerGaveThem', () => {
    const rows = [accountRow('Roma', '2026-03'), accountRow('Roma', '2026'), accountRow('Milano', '2026-03'), accountRow('Milano', '2026'), accountRow('Roma', '2026-04')];

    expect(accountGroups(rows).map((group) => [group.comune, group.rows.map((row) => row.period)])).toEqual([
      ['Roma', ['2026-03', '2026']],
      ['Milano', ['2026-03', '2026']],
      ['Roma', ['2026-04']],
    ]);
    expect(accountGroups([])).toEqual([]);
  });

  it('AccountPeriodLabel_YearMonthAndQuarter_AreWrittenForAPerson_AndALabelItDoesNotKnowAsTheServerWroteIt', () => {
    const month = { period: '2026-03', from: '2026-03-01', isYear: false };
    const quarter = { period: '2026-Q1', from: '2026-01-01', isYear: false };
    const year = { period: '2026', from: '2026-01-01', isYear: true };

    expect([month, quarter, year].map((row) => accountPeriodLabel(row, 'it', i18n.getFixedT('it')))).toEqual(['marzo 2026', '1º trimestre 2026', 'Anno 2026']);
    expect([month, quarter, year].map((row) => accountPeriodLabel(row, 'en', i18n.getFixedT('en')))).toEqual(['March 2026', 'Q1 2026', 'Year 2026']);
    expect(accountPeriodLabel({ period: '2026-W07', from: '2026-02-09', isYear: false }, 'it', i18n.getFixedT('it'))).toBe('2026-W07');
  });
});

describe('the words of the reasons', () => {
  const isWords = (text: string) => !/^[\w.]+$/.test(text);

  it('ExemptionReasonLabel_EveryCodeTheServerGives_HasItsOwnWordsInBothLanguages_AndAnUnknownOneIsWrittenAsItCame', () => {
    const codes = ['minor_age', 'resident', 'health_care', 'disability_companion', 'public_service', 'host_family', 'other', 'erased', 'restricted'];

    for (const language of ['it', 'en']) {
      const t = i18n.getFixedT(language);
      const words = codes.map((code) => exemptionReasonLabel(code, t));
      expect(words.every(isWords), `words of every code in ${language}: ${words.join(' | ')}`).toBe(true);
      expect(new Set(words).size).toBe(codes.length);
      expect(exemptionReasonLabel('a_reason_of_the_future', t)).toBe('a_reason_of_the_future');
      expect(exemptionReasonLabel('toString', t)).toBe('toString');
    }
    expect(exemptionReasonLabel('restricted', i18n.getFixedT('it'))).toBe('dettaglio dei motivi riservato');
    expect(exemptionReasonLabel('restricted', i18n.getFixedT('en'))).toBe('reason detail restricted');
  });

  it('StayReasonLabel_EveryCodeOfAStayWithNoAmount_HasItsOwnWordsInBothLanguages_AndAnUnknownOneIsWrittenAsItCame', () => {
    const codes = ['exempt', 'collected_by_channel', 'not_calculated', 'no_tax_due'];

    for (const language of ['it', 'en']) {
      const t = i18n.getFixedT(language);
      const words = codes.map((code) => stayReasonLabel(code, t));
      expect(words.every(isWords), `words of every code in ${language}: ${words.join(' | ')}`).toBe(true);
      expect(new Set(words).size).toBe(codes.length);
      expect(stayReasonLabel('a_reason_of_the_future', t)).toBe('a_reason_of_the_future');
    }
  });
});
