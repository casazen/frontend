import { addDays, isStayDate, nightsBetween, todayInZurich } from '@/lib/stay-dates';
import type { GuestRegisterPeriod } from '@/types/guest-register.types';

export const GUEST_REGISTER_MAX_DAYS = 366;

const DEFAULT_DAYS = 30;

export function defaultRegisterPeriod(now: Date = new Date()): GuestRegisterPeriod {
  const to = todayInZurich(now);
  return { from: addDays(to, 1 - DEFAULT_DAYS), to };
}

export type GuestRegisterPeriodProblem = 'missing' | 'order' | 'tooLong';

export function periodProblemOf(period: GuestRegisterPeriod): GuestRegisterPeriodProblem | null {
  if (!isStayDate(period.from) || !isStayDate(period.to)) return 'missing';
  if (period.to < period.from) return 'order';
  return nightsBetween(period.from, period.to) >= GUEST_REGISTER_MAX_DAYS ? 'tooLong' : null;
}

export function guestRegisterFileName(period: GuestRegisterPeriod): string {
  return `registro-ospiti-ch-${period.from}-${period.to}.csv`;
}

export interface GuestRegisterTable {
  header: string[];
  rows: string[][];
}

const SEPARATOR = ';';

const FORMULA_GUARD = /^'(?=[=+\-@\t\r])/;

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
