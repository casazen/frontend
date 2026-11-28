import { isAxiosError } from 'axios';
import { getProblemCode } from '@/lib/api-errors';
import type {
  BankColumnMapping,
  BankColumnsProblem,
  BankImportInstallment,
  BankImportPreview,
  BankImportSelection,
  BankImportSuggestion,
} from '@/types';

/**
 * What the import of a bank statement (the «Importa estratto conto» of the Canoni page) works out on the screen. The matching itself is
 * the server's: here only what the landlord has chosen is kept track of, and nothing is marked paid unless they confirm it.
 */

export const BANK_IMPORT_KEY = 'bank-import';

export const MAX_STATEMENT_BYTES = 8 * 1024 * 1024;

export const STATEMENT_ACCEPT = ['.csv', '.txt', '.xlsx', '.xml', '.sta', '.940', '.mt940'] as const;

const COLUMNS_UNRECOGNIZED = 'bank_statement_columns_unrecognized';

export function statementFileProblem(file: Pick<File, 'size'>): 'empty' | 'tooLarge' | null {
  if (file.size === 0) return 'empty';
  return file.size > MAX_STATEMENT_BYTES ? 'tooLarge' : null;
}

export interface ReviewRow {
  suggestion: BankImportSuggestion;
  installmentId: string;
  checked: boolean;
}

export function initialRows(preview: Pick<BankImportPreview, 'suggestions'>): ReviewRow[] {
  return preview.suggestions.map((suggestion) => ({
    suggestion,
    installmentId: suggestion.confidence === 'Low' ? '' : suggestion.installment.id,
    checked: suggestion.confidence === 'High',
  }));
}

export function splitRows(rows: readonly ReviewRow[]): { sure: ReviewRow[]; toCheck: ReviewRow[] } {
  return {
    sure: rows.filter((row) => row.suggestion.confidence === 'High'),
    toCheck: rows.filter((row) => row.suggestion.confidence !== 'High'),
  };
}

export function optionsOf(row: ReviewRow): BankImportInstallment[] {
  return [row.suggestion.installment, ...row.suggestion.alternatives];
}

export function withInstallment(row: ReviewRow, installmentId: string): ReviewRow {
  return { ...row, installmentId, checked: installmentId !== '' };
}

export function chosenElsewhere(rows: readonly ReviewRow[], index: number): ReadonlySet<string> {
  const chosen = new Set<string>();
  rows.forEach((row, other) => {
    if (other !== index && row.checked && row.installmentId !== '') chosen.add(row.installmentId);
  });
  return chosen;
}

export function selectionsOf(rows: readonly ReviewRow[]): BankImportSelection[] {
  const taken = new Set<string>();
  const selections: BankImportSelection[] = [];
  for (const row of rows) {
    if (!row.checked || row.installmentId === '' || taken.has(row.installmentId)) continue;
    taken.add(row.installmentId);
    selections.push({ fingerprint: row.suggestion.fingerprint, installmentId: row.installmentId });
  }
  return selections;
}

export function columnsProblemOf(error: unknown): BankColumnsProblem | null {
  if (!isAxiosError(error) || error.response?.status !== 422) return null;
  const data: unknown = error.response.data;
  if (getProblemCode(data) !== COLUMNS_UNRECOGNIZED || typeof data !== 'object' || data === null) return null;

  const { headerRow, columnCount, rows } = data as Partial<Record<keyof BankColumnsProblem, unknown>>;
  if (typeof headerRow !== 'number' || !Array.isArray(rows) || rows.some((row) => !Array.isArray(row))) return null;

  const table = (rows as unknown[][]).map((row) => row.map((cell) => (typeof cell === 'string' ? cell : '')));
  return {
    headerRow,
    columnCount: typeof columnCount === 'number' ? columnCount : Math.max(0, ...table.map((row) => row.length)),
    rows: table,
  };
}

export interface MappingChoice {
  hasTitles: boolean;
  date: string;
  description: string;
  amount: string;
}

export function initialMappingChoice(problem: BankColumnsProblem): MappingChoice {
  return { hasTitles: problem.headerRow >= 0 && problem.headerRow < problem.rows.length, date: '', description: '', amount: '' };
}

export function mappingOf(problem: BankColumnsProblem, choice: MappingChoice): BankColumnMapping | null {
  const { date, description, amount } = choice;
  if (date === '' || description === '' || amount === '') return null;
  if (new Set([date, description, amount]).size < 3) return null;
  return {
    headerRow: choice.hasTitles ? Math.max(problem.headerRow, 0) : -1,
    date: Number(date),
    description: Number(description),
    amount: Number(amount),
  };
}
