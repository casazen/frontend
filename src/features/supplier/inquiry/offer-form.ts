import { romeWallClock, romeWallTimeToUtc } from '@/lib/stay-dates';
import type { SendSupplierOfferBody, SupplierOffer } from '@/types/supplier-inquiry';
import { centsToInput, parseEuros } from '../services/lib/service-money';
import { emptyQuoteForm, newRowKey, problemsOf, type QuoteForm, type QuoteProblems } from '../requests/quote-form';

/**
 * What the sheet of the offer on a request on measure holds while the supplier writes (SP-08e): the lines and the note of a quote (the same
 * engine, decision SP-D30) and, because the time is never missing in an offer, the day, the start and how long the work lasts, as typed.
 * Nothing leaves before «Invia l'offerta»; the time is not held for the customer until they accept.
 */
export interface OfferForm {
  quote: QuoteForm;
  hours: string;
}

export type OfferTimeProblem = 'timeRequired' | 'timeInvalid' | 'timePast';
export type OfferDurationProblem = 'durationRequired' | 'durationInvalid';

export interface OfferProblems {
  quote: QuoteProblems;
  time: OfferTimeProblem | null;
  duration: OfferDurationProblem | null;
  valid: boolean;
}

export const OFFER_HOURS = { min: 0.25, max: 24 } as const;

export function emptyOfferForm(): OfferForm {
  return { quote: { ...emptyQuoteForm(), otherTime: true }, hours: '2' };
}

const pad = (value: number) => String(value).padStart(2, '0');

function hoursInput(minutes: number, decimalSeparator: ',' | '.'): string {
  const hours = Math.round((minutes / 60) * 100) / 100;
  return String(hours).replace('.', decimalSeparator);
}

export function offerFormOf(offer: SupplierOffer, decimalSeparator: ',' | '.'): OfferForm {
  const start = romeWallClock(offer.startUtc);
  const minutes = Math.round((Date.parse(offer.endUtc) - Date.parse(offer.startUtc)) / 60_000);
  return {
    quote: {
      rows:
        offer.lines.length > 0
          ? offer.lines.map((line) => ({ key: newRowKey(), label: line.label, amount: centsToInput(line.amountCents, decimalSeparator) }))
          : emptyQuoteForm().rows,
      note: offer.note ?? '',
      otherTime: true,
      day: start?.date ?? '',
      time: start ? `${pad(start.hour)}:${pad(start.minute)}` : '',
    },
    hours: Number.isFinite(minutes) && minutes > 0 ? hoursInput(minutes, decimalSeparator) : '2',
  };
}

export function hoursOf(text: string): number | null {
  const value = Number(text.trim().replace(',', '.'));
  return Number.isFinite(value) && value >= OFFER_HOURS.min && value <= OFFER_HOURS.max ? value : null;
}

/** What is wrong with the sheet, so that nothing the API would refuse for its form is sent. `now` is a parameter so that the past can be tested. */
export function offerProblemsOf(form: OfferForm, now: number = Date.now()): OfferProblems {
  const quote = problemsOf({ ...form.quote, otherTime: false });
  const start = form.quote.day && form.quote.time ? romeWallTimeToUtc(form.quote.day, form.quote.time) : null;
  const time: OfferTimeProblem | null = !form.quote.day || !form.quote.time ? 'timeRequired' : !start ? 'timeInvalid' : Date.parse(start) <= now ? 'timePast' : null;
  const duration: OfferDurationProblem | null = !form.hours.trim() ? 'durationRequired' : hoursOf(form.hours) === null ? 'durationInvalid' : null;
  return { quote, time, duration, valid: quote.valid && time === null && duration === null };
}

export function offerPayloadOf(form: OfferForm): SendSupplierOfferBody | null {
  const start = romeWallTimeToUtc(form.quote.day, form.quote.time);
  const hours = hoursOf(form.hours);
  if (!start || hours === null) return null;
  const note = form.quote.note.trim();
  return {
    lines: form.quote.rows.map((row) => ({ label: row.label.trim(), quantity: 1, unitAmountCents: parseEuros(row.amount).cents ?? 0 })),
    startUtc: start,
    endUtc: new Date(Date.parse(start) + Math.round(hours * 60) * 60_000).toISOString(),
    ...(note ? { note } : {}),
  };
}
