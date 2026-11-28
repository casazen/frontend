import type { PublicBookingStatus, PublicBookingView, PublicNegotiation } from '@/api/public-supplier-booking.api';
import type { IcsEvent } from './calendar-ics';

/**
 * "La mia richiesta" (`/fornitori/:slug/richiesta`, SP-12b): what a booking looks like to its customer, decided in one place from what
 * the server said. The page never works out what the customer may do (that is `actions`, which the server computes with the same
 * functions the endpoints enforce) and never adds up an amount (the price is the server's); it only chooses the words and the one thing
 * to put in front.
 */

export type RequestPhase =
  | 'waiting'
  | 'proposal'
  | 'quote'
  | 'taken'
  | 'inProgress'
  | 'done'
  | 'paid'
  | 'refused'
  | 'cancelled'
  | 'conversation'
  | 'offer'
  | 'cardPending'
  | 'offerLapsed';

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

function openInquiryPhaseOf(view: PublicBookingView): RequestPhase {
  if (!view.offer) return 'conversation';
  if (!view.actions.canRespondToOffer) return 'offerLapsed';
  return negotiationOf(view) === 'AwaitingPayment' ? 'cardPending' : 'offer';
}

export function phaseOf(view: PublicBookingView): RequestPhase {
  if (view.kind === 'Custom' && view.status === 'Richiesto') return openInquiryPhaseOf(view);
  switch (view.status) {
    case 'Richiesto':
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

export const REQUEST_STAGES = ['request', 'taken', 'inProgress', 'done', 'payment'] as const;

const STAGE_OF_STATUS: Partial<Record<PublicBookingStatus, number>> = { Richiesto: 0, PresoInCarico: 1, InCorso: 2, Completato: 3, Pagato: 4 };

export function stageIndexOf(status: PublicBookingStatus): number {
  return STAGE_OF_STATUS[status] ?? -1;
}

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

export function normalizeCode(value: string): string {
  const letters = value.toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, 10);
  return letters.length > 5 ? `${letters.slice(0, 5)}-${letters.slice(5)}` : letters;
}

export function viewSignature(view: PublicBookingView): string {
  const messages = view.thread?.messages ?? [];
  return [messages.length, messages[messages.length - 1]?.id ?? '', view.negotiation ?? '', view.offer?.sentAt ?? '', view.status, view.payment?.status ?? '', view.alternatives?.length ?? ''].join('|');
}
