import type { PublicBookingStatus, PublicBookingView } from '@/api/public-supplier-booking.api';
import type { IcsEvent } from './calendar-ics';

/**
 * "La mia richiesta" (`/fornitori/:slug/richiesta`, SP-12b): what a booking looks like to its customer, decided in one place from what
 * the server said. The page never works out what the customer may do (that is `actions`, which the server computes with the same
 * functions the endpoints enforce) and never adds up an amount (the price is the server's); it only chooses the words and the one thing
 * to put in front.
 */

/** Where the request is, in the customer's words. */
export type RequestPhase =
  /** New: the supplier has not answered. */
  | 'waiting'
  /** The supplier proposed another time and waits for the customer. */
  | 'proposal'
  /** The supplier sent a quote and waits for the customer. */
  | 'quote'
  /** Taken: the supplier is expected at the time. */
  | 'taken'
  | 'inProgress'
  /** The work is done. */
  | 'done'
  | 'paid'
  | 'refused'
  | 'cancelled'
  /** A request on measure (SP-12c): not handled by this page yet. */
  | 'custom';

export function phaseOf(view: PublicBookingView): RequestPhase {
  if (view.kind === 'Custom') return 'custom';
  switch (view.status) {
    case 'Richiesto':
      // The offer counts only while the customer can still answer it: past its time the request waits for the job that cancels it.
      if (view.quote && view.actions.canRespondToQuote) return 'quote';
      if (view.proposal && view.actions.canRespondToProposal) return 'proposal';
      return 'waiting';
    case 'PresoInCarico':
      return 'taken';
    case 'InCorso':
      return 'inProgress';
    case 'Completato':
      return 'done';
    case 'Pagato':
      return 'paid';
    case 'Rifiutato':
      return 'refused';
    case 'Annullato':
      return 'cancelled';
    default:
      return 'waiting';
  }
}

/** The steps of the path, in order. `Rifiutato` and `Annullato` are outside it. */
export const REQUEST_STAGES = ['request', 'taken', 'inProgress', 'done', 'payment'] as const;

const STAGE_OF_STATUS: Partial<Record<PublicBookingStatus, number>> = { Richiesto: 0, PresoInCarico: 1, InCorso: 2, Completato: 3, Pagato: 4 };

/** The index in {@link REQUEST_STAGES} of the step the request is at, or -1 for a refused or cancelled one. */
export function stageIndexOf(status: PublicBookingStatus): number {
  return STAGE_OF_STATUS[status] ?? -1;
}

/** How the top of the page feels: waiting for somebody, something to answer, all right, or over without the job. */
export type RequestTone = 'wait' | 'act' | 'ok' | 'err';

export function toneOf(phase: RequestPhase): RequestTone {
  switch (phase) {
    case 'waiting':
    case 'custom':
      return 'wait';
    case 'proposal':
    case 'quote':
      return 'act';
    case 'refused':
    case 'cancelled':
      return 'err';
    default:
      return 'ok';
  }
}

/**
 * The appointment for the calendar of the customer. It carries the **comune only**: the street, the floor and the notes for the access
 * are the customer's own data and the supplier's to use, and a calendar file travels (shared, synced, forwarded). The texts are the
 * page's own words in its language.
 */
export function icsEventOf(view: PublicBookingView, texts: { summary: string; description: string }): IcsEvent {
  return {
    uid: `${view.publicCode}@supplier-booking.casazen`,
    startUtc: view.startUtc,
    endUtc: view.endUtc,
    summary: texts.summary,
    location: view.place.city,
    description: texts.description,
  };
}

/**
 * The code of a booking as it is written in the e-mails, `XXXXX-XXXXX`, from what a person typed or pasted: capitals, no spaces and no
 * other separators, the dash in the middle. The server ignores the separators and the case anyway; this only makes what is shown
 * readable and tells when the code is complete (eleven characters).
 */
export function normalizeCode(value: string): string {
  const letters = value.toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, 10);
  return letters.length > 5 ? `${letters.slice(0, 5)}-${letters.slice(5)}` : letters;
}
