import { beforeEach, describe, expect, it } from 'vitest';
import i18n from '@/i18n/config';
import type { BalanceRow, BalanceTotal } from '@/types';
import { AxiosError, AxiosHeaders } from 'axios';
import {
  balanceSections,
  bucketName,
  formatCents,
  formatRate,
  isPartialMonth,
  paymentMethodLabel,
  reportView,
} from '../money-model';

/** The currency formats separate the number and the symbol with a no-break space: the tests compare with a plain one. */
const plain = (text: string | null) => text?.replace(/[\u00a0\u202f]/g, ' ') ?? null;

function balance(overrides: Partial<BalanceRow>): BalanceRow {
  return {
    bookingId: 'b-1',
    bookingCode: 'ABCDE-FGHIJ',
    propertyId: 'p-1',
    propertyName: 'Villa del Lago',
    source: 'Direct',
    checkIn: '2026-10-01',
    checkOut: '2026-10-05',
    currency: 'EUR',
    total: 100,
    totalCents: 10000,
    collected: 40,
    collectedCents: 4000,
    toCollect: 60,
    toCollectCents: 6000,
    overdue: true,
    basis: 'Payments',
    ...overrides,
  };
}

function failure(status: number): AxiosError {
  return new AxiosError('failed', undefined, undefined, undefined, {
    status,
    statusText: '',
    data: {},
    headers: {},
    config: { headers: new AxiosHeaders() },
  });
}

describe('money reports: the numbers of the server are written, never worked out (NF-97, NF-98)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
  });

  // Money: the cents the server sends are written digit for digit, whatever their size, with no division and no rounding.
  it.each([
    { cents: 123456, text: /^1\.?234,56 €$/ },
    { cents: 5, text: /^0,05 €$/ },
    { cents: 100, text: /^1,00 €$/ },
    { cents: -1999, text: /^-19,99 €$/ },
    { cents: 0, text: /^0,00 €$/ },
    { cents: 99999999999, text: /^999\.999\.999,99 €$/ },
    { cents: 1005, text: /^10,05 €$/ },
  ])('FormatCents_IsWrittenAsTheServerSaysIt_$cents', ({ cents, text }) => {
    expect(plain(formatCents(cents, 'EUR', 'it'))).toMatch(text);
  });

  it('FormatCents_EnglishAndFrancs_UseTheCurrencyOfTheRow', () => {
    expect(plain(formatCents(123456, 'EUR', 'en'))).toBe('€1,234.56');
    expect(plain(formatCents(123456, 'CHF', 'en'))).toBe('CHF 1,234.56');
    expect(plain(formatCents(123456, 'chf', 'it'))).toMatch(/^1\.?234,56 CHF$/);
  });

  // Money: an amount the server does not have, or a value that is not a whole count of cents, is never turned into a number.
  it.each([null, undefined, 12.5, Number.NaN, Number.POSITIVE_INFINITY, 2 ** 60])('FormatCents_%s_IsNotAnAmount', (value) => {
    expect(formatCents(value as number | null, 'EUR', 'it')).toBeNull();
  });

  it('FormatCents_CurrencyThatIsNotACode_KeepsTheAmountAndSaysWhatTheServerSaid', () => {
    expect(plain(formatCents(1050, 'XX', 'it'))).toBe('10,50 XX');
  });

  // Money: percentages are the server's four decimals, written as they are (never rounded to a whole number).
  it.each([
    { rate: 0.1534, text: '15,34%' },
    { rate: 0.12, text: '12%' },
    { rate: 0.3333, text: '33,33%' },
    { rate: 0.0001, text: '0,01%' },
    { rate: 1, text: '100%' },
    { rate: 0, text: '0%' },
  ])('FormatRate_IsWrittenAsTheServerSaysIt_$rate', ({ rate, text }) => {
    expect(plain(formatRate(rate, 'it'))).toBe(text);
  });

  it.each([null, undefined, Number.NaN])('FormatRate_%s_IsNotAnAmountEither', (value) => {
    expect(formatRate(value as number | null, 'it')).toBeNull();
  });

  // Money: two currencies are never put in one table with one total; the server's total of each is the one shown with its rows.
  it('BalanceSections_TwoCurrencies_AreTwoSectionsEachWithItsOwnTotal', () => {
    const totals: BalanceTotal[] = [
      { currency: 'CHF', amount: 80, amountCents: 8000, stayCount: 1 },
      { currency: 'EUR', amount: 60, amountCents: 6000, stayCount: 2 },
    ];
    const rows = [
      balance({ bookingId: 'a', currency: 'EUR' }),
      balance({ bookingId: 'b', currency: 'CHF', toCollect: 80, toCollectCents: 8000 }),
      balance({ bookingId: 'c', currency: 'EUR' }),
    ];

    const sections = balanceSections({ rows, totals });

    expect(sections.map((section) => section.currency)).toEqual(['CHF', 'EUR']);
    expect(sections[0]!.rows.map((row) => row.bookingId)).toEqual(['b']);
    expect(sections[1]!.rows.map((row) => row.bookingId)).toEqual(['a', 'c']);
    expect(sections.map((section) => section.total?.amountCents)).toEqual([8000, 6000]);
  });

  it('BalanceSections_RowsOfACurrencyWithoutATotal_AreKeptWithoutOneNeverDropped', () => {
    const sections = balanceSections({ rows: [balance({ currency: 'USD' })], totals: [] });

    expect(sections).toHaveLength(1);
    expect(sections[0]!.currency).toBe('USD');
    expect(sections[0]!.total).toBeNull();
  });

  it('BalanceSections_NothingToCollect_IsNoSection', () => {
    expect(balanceSections({ rows: [], totals: [] })).toEqual([]);
  });

  // Data: a bucket is a day or a month as the server cut it; a month the period cuts at one end says which days it covers.
  it('BucketName_DayAndMonth_AreWrittenInTheLanguageOfTheApp', () => {
    expect(bucketName({ unit: 'day', from: '2026-10-09' }, 'it')).toBe('9 ott 2026');
    expect(bucketName({ unit: 'month', from: '2026-10-01' }, 'it')).toBe('ottobre 2026');
    expect(bucketName({ unit: 'month', from: '2026-02-01' }, 'en')).toBe('February 2026');
  });

  it.each([
    { unit: 'month' as const, from: '2026-10-01', to: '2026-10-31', partial: false },
    { unit: 'month' as const, from: '2026-02-01', to: '2026-02-28', partial: false },
    { unit: 'month' as const, from: '2028-02-01', to: '2028-02-29', partial: false },
    { unit: 'month' as const, from: '2026-10-15', to: '2026-10-31', partial: true },
    { unit: 'month' as const, from: '2026-10-01', to: '2026-10-20', partial: true },
    { unit: 'day' as const, from: '2026-10-09', to: '2026-10-09', partial: false },
  ])('IsPartialMonth: $unit from $from to $to', ({ partial, ...bucket }) => {
    expect(isPartialMonth(bucket)).toBe(partial);
  });

  it('PaymentMethodLabel_KnownAndNewMethod_IsTheWordsOrTheValueAsItIs', () => {
    expect(paymentMethodLabel('BankTransfer', i18n.t)).toBe('Bonifico bancario');
    expect(paymentMethodLabel('SomethingNew', i18n.t)).toBe('SomethingNew');
  });
});

describe('reportView: what a money report read stands for', () => {
  // Trust: a 404 is "not found" even when the query still holds the old figures (TanStack Query keeps the data on an error).
  it('ReportView_NotFoundWithOldDataInTheCache_IsNotFoundNeverTheOldFigures', () => {
    expect(reportView({ data: { old: true }, isError: true, error: failure(404) })).toEqual({ kind: 'notFound' });
  });

  it('ReportView_AnyOtherFailureWithOldData_IsAnErrorNeverTheOldFigures', () => {
    const error = failure(500);

    expect(reportView({ data: { old: true }, isError: true, error })).toEqual({ kind: 'error', error });
  });

  it('ReportView_NullFromA403_IsForbiddenNotAnEmptyReport', () => {
    expect(reportView({ data: null, isError: false, error: null })).toEqual({ kind: 'forbidden' });
  });

  it('ReportView_NoDataYet_IsLoading', () => {
    expect(reportView({ data: undefined, isError: false, error: null })).toEqual({ kind: 'loading' });
  });

  it('ReportView_Data_IsReady', () => {
    const data = { rows: [] };

    expect(reportView({ data, isError: false, error: null })).toEqual({ kind: 'ready', data });
  });
});
