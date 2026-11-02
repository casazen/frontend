import { describe, expect, it } from 'vitest';
import type { BankColumnsProblem, BankImportConfidence, BankImportInstallment, BankImportSuggestion } from '@/types';
import { httpError } from '../../__tests__/lease-test-utils';
import {
  MAX_STATEMENT_BYTES,
  chosenElsewhere,
  columnsProblemOf,
  initialMappingChoice,
  initialRows,
  mappingOf,
  optionsOf,
  selectionsOf,
  splitRows,
  statementFileProblem,
  withInstallment,
} from '../bank-import';

function installment(id: string, tenantName: string | null = 'Giulia Verdi'): BankImportInstallment {
  return {
    id,
    leaseId: `lease-${id}`,
    propertyId: 'property-1',
    propertyName: 'Casa Trastevere',
    tenantName,
    periodStart: '2026-10-01',
    periodEnd: '2026-10-31',
    dueDate: '2026-10-05',
    amount: 900,
    currency: 'EUR',
  };
}

function suggestion(fingerprint: string, confidence: BankImportConfidence, best: string, alternatives: string[] = []): BankImportSuggestion {
  return {
    fingerprint,
    date: '2026-10-03',
    amount: 900,
    currency: 'EUR',
    description: 'BONIFICO CANONE OTTOBRE',
    payer: null,
    confidence,
    reasons: ['Amount'],
    installment: installment(best),
    alternatives: alternatives.map((id) => installment(id)),
  };
}

describe('bank import: the review', () => {
  it('initialRows_OnlyASureMatchIsTicked_ADoubtfulOneShowsItsProposal_AnAmountOnlyOneShowsNone', () => {
    const rows = initialRows({
      suggestions: [suggestion('a', 'High', 'i1'), suggestion('b', 'Medium', 'i2'), suggestion('c', 'Low', 'i3', ['i4'])],
    });

    expect(rows.map((row) => [row.checked, row.installmentId])).toEqual([
      [true, 'i1'],
      [false, 'i2'],
      [false, ''],
    ]);
  });

  it('splitRows_TheSureOnesFirstApart_TheOthersToCheck', () => {
    const rows = initialRows({
      suggestions: [suggestion('a', 'Medium', 'i1'), suggestion('b', 'High', 'i2'), suggestion('c', 'Low', 'i3')],
    });

    const { sure, toCheck } = splitRows(rows);

    expect(sure.map((row) => row.suggestion.fingerprint)).toEqual(['b']);
    expect(toCheck.map((row) => row.suggestion.fingerprint)).toEqual(['a', 'c']);
  });

  it('optionsOf_TheProposedInstallmentComesFirst', () => {
    const [row] = initialRows({ suggestions: [suggestion('a', 'Medium', 'i1', ['i2', 'i3'])] });

    expect(optionsOf(row).map((option) => option.id)).toEqual(['i1', 'i2', 'i3']);
  });

  it('withInstallment_ChoosingOneIsDeciding_ClearingItIsChangingYourMind', () => {
    const [row] = initialRows({ suggestions: [suggestion('a', 'Low', 'i1', ['i2'])] });

    const chosen = withInstallment(row, 'i2');
    expect(chosen).toMatchObject({ installmentId: 'i2', checked: true });
    expect(withInstallment(chosen, '')).toMatchObject({ installmentId: '', checked: false });
  });

  it('selectionsOf_OnlyTickedRowsWithAnInstallment_ReachTheServer', () => {
    const rows = initialRows({
      suggestions: [suggestion('a', 'High', 'i1'), suggestion('b', 'High', 'i2'), suggestion('c', 'Medium', 'i3'), suggestion('d', 'Low', 'i4')],
    });
    rows[1] = { ...rows[1], checked: false };

    expect(selectionsOf(rows)).toEqual([{ fingerprint: 'a', installmentId: 'i1' }]);
    // A row ticked with no installment chosen is nothing yet.
    expect(selectionsOf([{ ...rows[3], checked: true }])).toEqual([]);
  });

  it('selectionsOf_TwoCreditsForTheSameInstallment_OnlyTheFirstIsSent', () => {
    const rows = initialRows({ suggestions: [suggestion('a', 'High', 'i1'), suggestion('b', 'High', 'i1')] });

    expect(selectionsOf(rows)).toEqual([{ fingerprint: 'a', installmentId: 'i1' }]);
  });

  it('chosenElsewhere_TheInstallmentsOfTheOtherTickedRows_NotTheRowsOwn', () => {
    const rows = initialRows({ suggestions: [suggestion('a', 'High', 'i1'), suggestion('b', 'Medium', 'i2', ['i1']), suggestion('c', 'High', 'i3')] });
    rows[2] = { ...rows[2], checked: false };

    expect([...chosenElsewhere(rows, 1)]).toEqual(['i1']);
    expect([...chosenElsewhere(rows, 0)]).toEqual([]);
  });
});

describe('bank import: the file', () => {
  it('statementFileProblem_AnEmptyOrTooLargeFile_IsRefusedBeforeItIsSent', () => {
    expect(statementFileProblem({ size: 0 })).toBe('empty');
    expect(statementFileProblem({ size: MAX_STATEMENT_BYTES + 1 })).toBe('tooLarge');
    expect(statementFileProblem({ size: MAX_STATEMENT_BYTES })).toBeNull();
    expect(statementFileProblem({ size: 1200 })).toBeNull();
  });
});

describe('bank import: the columns', () => {
  const problem: BankColumnsProblem = { headerRow: 0, columnCount: 3, rows: [['Foo', 'Bar', 'Baz'], ['03/10/2026', 'Canone', '900,00']] };

  it('columnsProblemOf_The422WithTheRows_IsReadBack', () => {
    const error = httpError(422, { code: 'bank_statement_columns_unrecognized', headerRow: 0, columnCount: 3, rows: problem.rows });

    expect(columnsProblemOf(error)).toEqual(problem);
  });

  it('columnsProblemOf_AnotherErrorOrAMalformedBody_IsNothing', () => {
    expect(columnsProblemOf(httpError(422, { code: 'bank_statement_empty' }))).toBeNull();
    expect(columnsProblemOf(httpError(500, { code: 'bank_statement_columns_unrecognized', headerRow: 0, rows: [] }))).toBeNull();
    expect(columnsProblemOf(httpError(422, { code: 'bank_statement_columns_unrecognized', headerRow: 'x', rows: [] }))).toBeNull();
    expect(columnsProblemOf(httpError(422, { code: 'bank_statement_columns_unrecognized', headerRow: 0, rows: ['not a row'] }))).toBeNull();
    expect(columnsProblemOf(httpError())).toBeNull();
    expect(columnsProblemOf(new Error('boom'))).toBeNull();
  });

  it('columnsProblemOf_NonTextCellsBecomeEmpty_AndTheCountIsDerivedWhenMissing', () => {
    const error = httpError(422, { code: 'bank_statement_columns_unrecognized', headerRow: -1, rows: [['a', 5, null], ['b']] });

    expect(columnsProblemOf(error)).toEqual({ headerRow: -1, columnCount: 3, rows: [['a', '', ''], ['b']] });
  });

  it('initialMappingChoice_TitlesWhenTheServerFoundARowThatLooksLikeThem', () => {
    expect(initialMappingChoice(problem)).toEqual({ hasTitles: true, date: '', description: '', amount: '' });
    expect(initialMappingChoice({ ...problem, headerRow: -1 }).hasTitles).toBe(false);
  });

  it('initialMappingChoice_ARowOfTitlesTheLandlordCannotSee_IsNotAssumed', () => {
    // The server saw titles below the rows it sent back: with nothing to look at, the landlord is not told there are titles.
    expect(initialMappingChoice({ ...problem, headerRow: 7 }).hasTitles).toBe(false);
  });

  it('mappingOf_ThreeDifferentColumns_AreAMapping', () => {
    const choice = { hasTitles: true, date: '0', description: '1', amount: '2' };

    expect(mappingOf(problem, choice)).toEqual({ headerRow: 0, date: 0, description: 1, amount: 2 });
    expect(mappingOf(problem, { ...choice, hasTitles: false })).toEqual({ headerRow: -1, date: 0, description: 1, amount: 2 });
    // The titles the landlord says there are, where the server saw none: the first row.
    expect(mappingOf({ ...problem, headerRow: -1 }, choice)).toEqual({ headerRow: 0, date: 0, description: 1, amount: 2 });
  });

  it('mappingOf_AMissingOrRepeatedColumn_IsNotAMapping', () => {
    expect(mappingOf(problem, { hasTitles: true, date: '0', description: '', amount: '2' })).toBeNull();
    expect(mappingOf(problem, { hasTitles: true, date: '0', description: '0', amount: '2' })).toBeNull();
  });
});
