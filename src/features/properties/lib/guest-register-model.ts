import { addDays, isStayDate, nightsBetween, todayInZurich } from '@/lib/stay-dates';
import type { GuestRegisterPeriod } from '@/types/guest-register.types';

/**
 * The pure part of the guest register layer (E31/F02/US02/T01, NF-130): the period the host picks, the rules the server applies to it (so the screen says no before it asks), and the
 * reading of the file for the printed sheet.
 */

/** The longest period of a register, both ends counted: a year, a leap year included (`GuestRegisterFile.MaxPeriodDays` of the backend). */
export const GUEST_REGISTER_MAX_DAYS = 366;

/** How many days the register opens on: the last thirty, today included. */
const DEFAULT_DAYS = 30;

/**
 * The period the layer opens on: the last 30 days, ending **today** (the register is for the arrivals in progress too: the host prints it for the guests who are in the house now),
 * on the clock of Switzerland, which the arrival days of the register are counted on.
 */
export function defaultRegisterPeriod(now: Date = new Date()): GuestRegisterPeriod {
  const to = todayInZurich(now);
  return { from: addDays(to, 1 - DEFAULT_DAYS), to };
}

/** What is wrong with a period, as the key of the text that says it (`guestRegister.period.<problem>`), or `null` when the server can make the register. */
export type GuestRegisterPeriodProblem = 'missing' | 'order' | 'tooLong';

/**
 * The rules the server applies (`GuestRegisterFile.PeriodErrorOf`): both days are there and are days, the last is not before the first, and the period is at most 366 days with both
 * ends counted. The screen asks nothing of the server for a period that is not one.
 */
export function periodProblemOf(period: GuestRegisterPeriod): GuestRegisterPeriodProblem | null {
  if (!isStayDate(period.from) || !isStayDate(period.to)) return 'missing';
  if (period.to < period.from) return 'order';
  return nightsBetween(period.from, period.to) >= GUEST_REGISTER_MAX_DAYS ? 'tooLong' : null;
}

/** The name the file is saved under when the server gives none: the one it would have given (`registro-ospiti-ch-2026-01-01-2026-03-31.csv`). */
export function guestRegisterFileName(period: GuestRegisterPeriod): string {
  return `registro-ospiti-ch-${period.from}-${period.to}.csv`;
}

/** The table of the file: its header line (the words of the language of the request) and one line for each guest. */
export interface GuestRegisterTable {
  header: string[];
  rows: string[][];
}

const SEPARATOR = ';';

/** The apostrophe the writer puts before a text that a spreadsheet would run as a formula (it starts with `= + - @`, a tab or a CR): it is not part of the text. */
const FORMULA_GUARD = /^'(?=[=+\-@\t\r])/;

/**
 * Reads the CSV the API writes for the register (`CsvWriter` of the backend): an optional byte order mark, `;` between the cells, a cell with the separator, a quote or a line break
 * quoted with the quotes doubled, CRLF after each line, the formula guard undone. Empty lines are no line. The first line is the header; a shorter line is filled with empty cells (the
 * signature column is empty by design), so every line has the cells of the header. The text is the person's: nothing of it is kept anywhere but in what the caller does with the table.
 */
export function parseGuestRegisterCsv(text: string): GuestRegisterTable {
  const source = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const lines: string[][] = [];
  let line: string[] = [];
  let cell = '';
  let quoted = false;
  let open = false;

  const endCell = () => {
    line.push(cell.replace(FORMULA_GUARD, ''));
    cell = '';
  };
  const endLine = () => {
    if (open || cell !== '') {
      endCell();
      lines.push(line);
    }
    line = [];
    cell = '';
    open = false;
  };

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (quoted) {
      if (char !== '"') cell += char;
      else if (source[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else quoted = false;
    } else if (char === '"' && cell === '') {
      quoted = true;
      open = true;
    } else if (char === SEPARATOR) {
      endCell();
      open = true;
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && source[index + 1] === '\n') index += 1;
      endLine();
    } else {
      cell += char;
      open = true;
    }
  }
  endLine();

  const [header = [], ...rows] = lines;
  return { header, rows: rows.map((row) => (row.length >= header.length ? row : [...row, ...Array<string>(header.length - row.length).fill('')])) };
}
