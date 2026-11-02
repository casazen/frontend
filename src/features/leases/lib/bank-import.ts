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

/** What holds the confirmation back for its six seconds (`holdForUndo`): one statement at a time. */
export const BANK_IMPORT_KEY = 'bank-import';

/** The largest file the server reads (8 MB): a bigger one is refused here, before it is sent. */
export const MAX_STATEMENT_BYTES = 8 * 1024 * 1024;

/** What the file picker offers. The server decides on the content, so a file with another name is still tried. */
export const STATEMENT_ACCEPT = ['.csv', '.txt', '.xlsx', '.xml', '.sta', '.940', '.mt940'] as const;

/** The 422 code that says the importer did not recognize the columns of a table. */
const COLUMNS_UNRECOGNIZED = 'bank_statement_columns_unrecognized';

/** A file the screen refuses without asking the server. */
export function statementFileProblem(file: Pick<File, 'size'>): 'empty' | 'tooLarge' | null {
  if (file.size === 0) return 'empty';
  return file.size > MAX_STATEMENT_BYTES ? 'tooLarge' : null;
}

/** One credit of the review: the installment chosen for it (`''` while none is) and whether the landlord ticked it. */
export interface ReviewRow {
  suggestion: BankImportSuggestion;
  installmentId: string;
  checked: boolean;
}

/**
 * The review as the server proposes it. Only a sure match is ticked; a doubtful one shows its proposal and waits to be ticked; one with only
 * the amount in common shows no proposal at all, so the landlord has to pick the installment before anything can be confirmed.
 */
export function initialRows(preview: Pick<BankImportPreview, 'suggestions'>): ReviewRow[] {
  return preview.suggestions.map((suggestion) => ({
    suggestion,
    installmentId: suggestion.confidence === 'Low' ? '' : suggestion.installment.id,
    checked: suggestion.confidence === 'High',
  }));
}

/** The sure ones, and the ones to look at (doubtful or amount only), in the order the server gave. */
export function splitRows(rows: readonly ReviewRow[]): { sure: ReviewRow[]; toCheck: ReviewRow[] } {
  return {
    sure: rows.filter((row) => row.suggestion.confidence === 'High'),
    toCheck: rows.filter((row) => row.suggestion.confidence !== 'High'),
  };
}

/** The installments a credit can pay: the proposed one first. */
export function optionsOf(row: ReviewRow): BankImportInstallment[] {
  return [row.suggestion.installment, ...row.suggestion.alternatives];
}

/** What a row says when the landlord picks (or clears) its installment: choosing one is deciding, clearing is changing their mind. */
export function withInstallment(row: ReviewRow, installmentId: string): ReviewRow {
  return { ...row, installmentId, checked: installmentId !== '' };
}

/** The installments another row has chosen and ticked: a second credit cannot pay them too. */
export function chosenElsewhere(rows: readonly ReviewRow[], index: number): ReadonlySet<string> {
  const chosen = new Set<string>();
  rows.forEach((row, other) => {
    if (other !== index && row.checked && row.installmentId !== '') chosen.add(row.installmentId);
  });
  return chosen;
}

/** What goes to the server: the ticked rows that have an installment, the first row keeping an installment two rows chose. */
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

/** The first rows of the table the server sends when it did not recognize the columns, read back from the failed answer. */
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

/** What the landlord says about a table the importer could not read: which column holds what (`''` while not chosen). */
export interface MappingChoice {
  /** The first row holds the titles of the columns, not a movement. */
  hasTitles: boolean;
  date: string;
  description: string;
  amount: string;
}

/** The choice the server's guess suggests: titles when it found a row that looks like them and the landlord can see it among the rows. */
export function initialMappingChoice(problem: BankColumnsProblem): MappingChoice {
  return { hasTitles: problem.headerRow >= 0 && problem.headerRow < problem.rows.length, date: '', description: '', amount: '' };
}

/** The mapping to send, or null while the three columns are not chosen or one column is given two roles. */
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
