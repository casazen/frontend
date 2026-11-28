import { romeWallClock, romeWallTimeToUtc } from '@/lib/stay-dates';
import type { SendServiceRequestQuoteDto, ServiceRequestQuote } from '@/types/service-request';
import { SERVICE_LIMITS } from '../services/lib/service-limits';
import { centsToInput, parseEuros } from '../services/lib/service-money';

export const QUOTE_LIMITS = {
  maxLines: 20,
  labelMaxLength: 120,
  noteMaxLength: 500,
  maxAmountCents: SERVICE_LIMITS.maxAmountCents,
} as const;

export interface QuoteRow {
  key: string;
  label: string;
  amount: string;
  fresh?: boolean;
}

export interface QuoteForm {
  rows: QuoteRow[];
  note: string;
  /** Another time instead of the one the request has. `day` is `YYYY-MM-DD` and `time` is `HH:mm`, both on the clock of Europe/Rome. */
  otherTime: boolean;
  day: string;
  time: string;
}

export type QuoteRowProblem = 'labelRequired' | 'amountRequired' | 'amountInvalid' | 'amountRange';
export type QuoteTimeProblem = 'timeRequired' | 'timeInvalid';

export interface QuoteProblems {
  rows: Record<string, { label: QuoteRowProblem | null; amount: QuoteRowProblem | null }>;
  total: 'totalRange' | null;
  time: QuoteTimeProblem | null;
  valid: boolean;
}

let rowCounter = 0;

export function newRowKey(): string {
  rowCounter += 1;
  return `quote-row-${rowCounter}`;
}

export function emptyQuoteForm(): QuoteForm {
  return { rows: [{ key: newRowKey(), label: '', amount: '' }], note: '', otherTime: false, day: '', time: '' };
}

const pad = (value: number) => String(value).padStart(2, '0');

export function quoteFormOf(quote: ServiceRequestQuote, decimalSeparator: ',' | '.'): QuoteForm {
  const start = quote.scheduledStart ? romeWallClock(quote.scheduledStart) : null;
  return {
    rows:
      quote.lines.length > 0
        ? quote.lines.map((line) => ({ key: newRowKey(), label: line.label, amount: centsToInput(line.amountCents, decimalSeparator) }))
        : emptyQuoteForm().rows,
    note: quote.note ?? '',
    otherTime: start !== null,
    day: start?.date ?? '',
    time: start ? `${pad(start.hour)}:${pad(start.minute)}` : '',
  };
}

export function totalCentsOf(rows: readonly QuoteRow[]): number {
  let total = 0;
  for (const row of rows) {
    const { cents } = parseEuros(row.amount);
    if (cents !== null && cents >= 1 && cents <= QUOTE_LIMITS.maxAmountCents) total += cents;
  }
  return total;
}

function amountProblem(text: string): QuoteRowProblem | null {
  const { cents, problem } = parseEuros(text);
  if (problem === 'blank') return 'amountRequired';
  if (problem === 'invalid' || cents === null) return 'amountInvalid';
  return cents < 1 || cents > QUOTE_LIMITS.maxAmountCents ? 'amountRange' : null;
}

/** What is wrong with the sheet, so that nothing the API would refuse for its form is sent. */
export function problemsOf(form: QuoteForm): QuoteProblems {
  const rows: QuoteProblems['rows'] = {};
  for (const row of form.rows) {
    rows[row.key] = { label: row.label.trim() ? null : 'labelRequired', amount: amountProblem(row.amount) };
  }

  const time: QuoteTimeProblem | null = !form.otherTime
    ? null
    : !form.day || !form.time
      ? 'timeRequired'
      : romeWallTimeToUtc(form.day, form.time) === ''
        ? 'timeInvalid'
        : null;
  const total = totalCentsOf(form.rows) > QUOTE_LIMITS.maxAmountCents ? 'totalRange' : null;
  const lineCount = form.rows.length >= 1 && form.rows.length <= QUOTE_LIMITS.maxLines;
  const rowsValid = Object.values(rows).every((row) => row.label === null && row.amount === null);

  return { rows, total, time, valid: lineCount && rowsValid && total === null && time === null };
}

export function payloadOf(form: QuoteForm, requestMinutes: number | null): SendServiceRequestQuoteDto {
  const note = form.note.trim();
  const payload: SendServiceRequestQuoteDto = {
    lines: form.rows.map((row) => ({ label: row.label.trim(), amountCents: parseEuros(row.amount).cents ?? 0 })),
  };
  if (note) payload.note = note;

  const start = form.otherTime ? romeWallTimeToUtc(form.day, form.time) : '';
  if (start) {
    payload.scheduledStartUtc = start;
    if (requestMinutes) payload.scheduledEndUtc = new Date(Date.parse(start) + requestMinutes * 60_000).toISOString();
  }
  return payload;
}
