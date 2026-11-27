import { describe, expect, it } from 'vitest';
import i18n from '@/i18n/config';
import { F24_CURRENCY, batchReference, exactMoney, failureMessage, problemCodeOf } from '../agency-finance';
import { maskIban } from '../iban';

const problem = (status: number, data: unknown) => Object.assign(new Error('failed'), { isAxiosError: true, response: { status, data } });
const t = i18n.getFixedT('it');
const failure = (error: unknown) => failureMessage(error, t, 'generico', 'non trovato');

describe('maskIban: a bank account is never shown in full', () => {
  it('MaskIban_LongAccount_KeepsTheCountryTheCheckDigitsAndTheEndOnly', () => {
    expect(maskIban('IT60X0542811101000000123456')).toBe('IT60 •••• 3456');
    expect(maskIban('it60 x054 2811 1010 0000 0123 456')).toBe('IT60 •••• 3456');
    expect(maskIban('CH93-0076-2011-6238-5295-7')).toBe('CH93 •••• 2957');
  });

  it('MaskIban_NeverContainsTheMiddleOfTheAccount', () => {
    const masked = maskIban('IT60X0542811101000000123456');

    expect(masked).not.toContain('0542811101');
    expect(masked.length).toBeLessThan('IT60X0542811101000000123456'.length);
  });

  it('MaskIban_TooShortToHideAnything_ShowsNothingOfIt', () => {
    expect(maskIban('IT60')).toBe('••••');
    expect(maskIban('')).toBe('••••');
  });
});

describe('exactMoney: the figure of the server in its own currency, never rounded', () => {
  it.each([
    [1234.5, 'CHF', 'it-IT', /^1234,50\s*CHF$/],
    [830.25, 'EUR', 'it-IT', /^830,25\s*€$/],
    [10000, 'EUR', 'it-IT', /^10\.000,00\s*€$/],
    [0, 'CHF', 'it-IT', /^0,00\s*CHF$/],
    [1234.5, 'CHF', 'en-GB', /^CHF\s*1,234\.50$/],
  ])('ExactMoney_%s_%s_%s_IsTheFigureWithItsCurrency', (amount, currency, locale, expected) => {
    expect(exactMoney(amount, currency, locale)).toMatch(expected);
  });

  it('ExactMoney_MoreThanTwoDecimals_AreKeptNotRoundedAway', () => {
    // The formatter of a currency would write 12,35 (another figure): the money pages show what the server sent.
    expect(exactMoney(12.345, 'EUR', 'it-IT')).toMatch(/^12,345\s*€$/);
    expect(exactMoney(0.001, 'CHF', 'it-IT')).toMatch(/^0,001\s*CHF$/);
  });

  it('ExactMoney_TheSignIsTheServers_NothingIsAdded', () => {
    expect(exactMoney(-50, 'EUR', 'it-IT')).toMatch(/^-50,00\s*€$/);
    expect(exactMoney(50, 'EUR', 'it-IT')).not.toContain('-');
  });

  it('ExactMoney_CurrencyTheRuntimeDoesNotKnow_TheFigureAndTheCodeAsTheyCame', () => {
    expect(exactMoney(12.5, 'NOT-A-CODE', 'it-IT')).toBe('12.5 NOT-A-CODE');
  });
});

describe('batchReference: the reference of a wire file is the one the statements print', () => {
  it('BatchReference_FirstEightDigitsOfTheIdInCapitals', () => {
    expect(batchReference('b1b2c3d4-0000-4000-8000-000000000000')).toBe('WB-B1B2C3D4');
  });
});

describe('failureMessage: a failure of a money page in words', () => {
  it('FailureMessage_CodeTheAppKnows_ItsText_WhateverTheStatus', () => {
    expect(failure(problem(422, { code: 'wire_batch_schema_unavailable' }))).toContain('manca il file di controllo');
    expect(failure(problem(404, { code: 'f24_not_found' }))).toBe('Per questo mese non c\'è un F24.');
  });

  it('FailureMessage_NotFoundWithoutACode_IsNotFoundInTheWordsOfThePage', () => {
    expect(failure(problem(404, { detail: 'Wire batch 3f2a not found' }))).toBe('non trovato');
    expect(failure(problem(404, 'plain text'))).toBe('non trovato');
  });

  it('FailureMessage_ServerFailure_IsTheGenericSentenceOfTheAction', () => {
    expect(failure(problem(500, 'Internal error'))).toBe('generico');
    expect(failure(new Error('boom'))).toBe('generico');
  });

  it('FailureMessage_OtherRefusal_TheTextTheServerWrote', () => {
    expect(failure(problem(422, { detail: 'Il conto non è valido per questo bonifico.' }))).toBe('Il conto non è valido per questo bonifico.');
  });
});

describe('problemCodeOf', () => {
  it('ProblemCodeOf_TheCodeOfTheBody_OrNothing', () => {
    expect(problemCodeOf(problem(422, { code: 'batch_already_paid' }))).toBe('batch_already_paid');
    expect(problemCodeOf(problem(422, 'text'))).toBeUndefined();
    expect(problemCodeOf(new Error('x'))).toBeUndefined();
  });
});

describe('F24_CURRENCY', () => {
  it('F24_IsDeclaredInEuro', () => {
    expect(F24_CURRENCY).toBe('EUR');
  });
});
