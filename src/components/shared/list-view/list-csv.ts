import { saveBlobAs } from '@/lib/file-download';
import { todayInRome } from '@/lib/stay-dates';
import type { ListColumn, ListDefinition } from './list-types';

/**
 * The CSV of a list (UI-14), made in the browser from the rows on the screen: nothing leaves the page and no API is called.
 *
 * - Every cell is quoted and a quote inside it is doubled, so a comma, a semicolon or a line break in a name cannot move
 *   the columns.
 * - A cell that starts with `=`, `+`, `-`, `@`, a tab or a carriage return is read by a spreadsheet as a formula (a guest who
 *   writes `=HYPERLINK(...)` as a name, and a host who opens the file in Excel): it is written with a `'` in front, the
 *   usual defence. A real number is not text and is written as it is.
 * - The file starts with a byte order mark, which makes Excel read it as UTF-8 (accents stay accents).
 * - The separator is `;` for Italian, where the comma is the decimal mark and Excel expects it, and `,` otherwise.
 */

export type CsvSeparator = ';' | ',';
export type CsvValue = string | number | null | undefined;

const BYTE_ORDER_MARK = '\uFEFF';
const FORMULA_START = /^[=+\-@\t\r]/;

/** The separator of the file: the one the list asks for, else `;` in Italian and `,` in any other language. */
export function csvSeparatorFor<Row>(def: ListDefinition<Row>, language: string): CsvSeparator {
  const asked = typeof def.csv === 'object' ? def.csv.separator : undefined;
  if (asked) return asked;
  return language.toLowerCase().startsWith('it') ? ';' : ',';
}

/** One cell, quoted and made safe against being read as a formula. */
export function csvCell(value: CsvValue, separator: CsvSeparator): string {
  let text: string;
  if (value === null || value === undefined) {
    text = '';
  } else if (typeof value === 'number') {
    // A number is a number (a negative one starts with "-"): no guard. Where `;` separates, the decimal mark is the comma.
    text = Number.isFinite(value) ? String(value) : '';
    if (separator === ';') text = text.replace('.', ',');
  } else {
    text = FORMULA_START.test(value) ? `'${value}` : value;
  }
  return `"${text.replace(/"/g, '""')}"`;
}

/** The whole file: a header line and a line per row. */
export function buildCsv(header: readonly CsvValue[], lines: readonly (readonly CsvValue[])[], separator: CsvSeparator): string {
  const toLine = (cells: readonly CsvValue[]) => cells.map((cell) => csvCell(cell, separator)).join(separator);
  return BYTE_ORDER_MARK + [header, ...lines].map(toLine).join('\r\n');
}

/**
 * What a column puts in the CSV for a row: what `csv` says; else the cell if it is plain text or a number; else the value
 * the column sorts by; else nothing. A cell made of components (a badge, an avatar) cannot be read back as text, which is
 * why such a column wants a `csv`.
 */
export function columnCsvValue<Row>(column: ListColumn<Row>, row: Row): CsvValue {
  if (column.csv) return column.csv(row);
  const cell = column.render(row, { open: (children) => children });
  if (typeof cell === 'string' || typeof cell === 'number') return cell;
  return column.sort ? column.sort(row) : '';
}

/** The CSV of `rows` with `columns` (the ones the person sees). */
export function listToCsv<Row>(
  columns: readonly ListColumn<Row>[],
  rows: readonly Row[],
  separator: CsvSeparator,
): string {
  return buildCsv(
    columns.map((column) => column.label),
    rows.map((row) => columns.map((column) => columnCsvValue(column, row))),
    separator,
  );
}

/** `ospiti-2026-10-09.csv`: the list's name and today (in Rome). */
export function csvFileName<Row>(def: ListDefinition<Row>, now: Date = new Date()): string {
  const name = (typeof def.csv === 'object' ? def.csv.fileName : undefined) || def.key;
  return `${name}-${todayInRome(now)}.csv`;
}

/** Makes the browser save the CSV. */
export function downloadCsv(fileName: string, content: string): void {
  saveBlobAs(new Blob([content], { type: 'text/csv;charset=utf-8' }), fileName);
}
