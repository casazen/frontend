import { romeWallClock, romeWallTimeToUtc } from '@/lib/stay-dates';
import type { SendServiceRequestQuoteDto, ServiceRequestQuote } from '@/types/service-request';
import { SERVICE_LIMITS } from '../services/lib/service-limits';
import { centsToInput, parseEuros } from '../services/lib/service-money';

/**
 * The limits the API holds a quote to (`ServiceRequestLimits`, SP-04b). The sheet checks them before asking; the server checks them again
 * and its answer wins. The amounts are in cents: no float ever holds a price. The total the sheet shows is for the supplier to read: it is
 * not sent, and the server adds the lines up itself.
 */
export const QUOTE_LIMITS = {
  maxLines: 20,
  labelMaxLength: 120,
  noteMaxLength: 500,
  /** Highest line, and highest total (100,000 €); the lowest line is 1 cent. */
  maxAmountCents: SERVICE_LIMITS.maxAmountCents,
} as const;

export interface QuoteRow {
  /** Identity of the row for React: the position changes when a row before it is taken out. */
  key: string;
  label: string;
  /** The amount in euros as the person typed it (`80`, `80,50`, `1.200`). */
  amount: string;
  /** Added while the sheet was open: the focus goes to it. */
  fresh?: boolean;
}

/** What the sheet holds while the supplier writes: texts as typed, parsed only to check and to send. */
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
  /** What is wrong in each row, by its key. */
  rows: Record<string, { label: QuoteRowProblem | null; amount: QuoteRowProblem | null }>;
  /** The lines add up to more than the API takes. */
  total: 'totalRange' | null;
  time: QuoteTimeProblem | null;
  valid: boolean;
}

let rowCounter = 0;

/** A key for a new row. */
export function newRowKey(): string {
  rowCounter += 1;
  return `quote-row-${rowCounter}`;
}

/** A sheet for a quote that does not exist yet: one empty line. */
export function emptyQuoteForm(): QuoteForm {
  return { rows: [{ key: newRowKey(), label: '', amount: '' }], note: '', otherTime: false, day: '', time: '' };
}

const pad = (value: number) => String(value).padStart(2, '0');

/** A sheet filled with the quote that waits, to change it: the new one replaces it when it is sent. */
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

/** What the lines add up to, in cents, counting only the amounts that are valid: the live total under the lines. */
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

/**
 * The body of `POST service-requests/{id}/quote` for a valid sheet. The lines go with their amounts in cents; the total is not sent (the
 * server adds the lines up). Another time goes as UTC instants worked out from the Rome clock, with the end after the duration the request
 * already has (the server takes the duration of the service when it is left out).
 */
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
