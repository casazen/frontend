import type { PublicBookingStatus, PublicBookingView, PublicNegotiation } from '@/api/public-supplier-booking.api';
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
  /** A request on measure that is still new (SP-12c): the customer writes with the supplier, nobody has made an offer. */
  | 'conversation'
  /** A request on measure with an offer the customer can answer. */
  | 'offer'
  /** The offer was accepted and is paid inside CasaZen: the card is not through yet. */
  | 'cardPending'
  /** A request on measure with an offer nobody can answer any more (its time passed, or the supplier is not available). */
  | 'offerLapsed';

/** The negotiation of a request on measure, as the server states it; a state the page does not know is read as a conversation. */
export function negotiationOf(view: PublicBookingView): PublicNegotiation {
  switch (view.negotiation) {
    case 'AwaitingSupplier':
    case 'InConversation':
    case 'OfferSent':
    case 'AwaitingPayment':
    case 'OfferDeclined':
    case 'Agreed':
    case 'Declined':
    case 'Expired':
    case 'Closed':
      return view.negotiation;
    default:
      return 'InConversation';
  }
}

/** Where a request on measure that is still new stands: writing, an offer to answer, a card to give, or an offer that cannot be answered. */
function openInquiryPhaseOf(view: PublicBookingView): RequestPhase {
  if (!view.offer) return 'conversation';
  if (!view.actions.canRespondToOffer) return 'offerLapsed';
  return negotiationOf(view) === 'AwaitingPayment' ? 'cardPending' : 'offer';
}

export function phaseOf(view: PublicBookingView): RequestPhase {
  // Once the offer is taken the request goes the way of every other: taken, in progress, done, paid.
  if (view.kind === 'Custom' && view.status === 'Richiesto') return openInquiryPhaseOf(view);
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
    case 'conversation':
    case 'offerLapsed':
      return 'wait';
    case 'proposal':
    case 'quote':
    case 'offer':
    case 'cardPending':
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

/**
 * What changed on a request on measure between two readings, in one string: the number and the last of the messages, the negotiation, the
 * version of the offer, the status and the money. The polling of the page doubles its wait while this stays the same.
 */
export function viewSignature(view: PublicBookingView): string {
  const messages = view.thread?.messages ?? [];
  return [messages.length, messages[messages.length - 1]?.id ?? '', view.negotiation ?? '', view.offer?.sentAt ?? '', view.status, view.payment?.status ?? '', view.alternatives?.length ?? ''].join('|');
}
