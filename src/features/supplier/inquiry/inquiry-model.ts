import { formatRomeDateTime, romeDateOf, todayInRome } from '@/lib/stay-dates';
import type { ServiceRequestQuote, SupplierServiceRequest } from '@/types/service-request';
import type { SupplierNegotiation, SupplierOffer } from '@/types/supplier-inquiry';
import { phaseOf } from '../requests/request-model';

type Translate = (key: string, options?: Record<string, unknown>) => string;

/** The request is one "su misura" of the showcase (SP-10b): no time and no price until the supplier's offer is accepted. */
export function isInquiry(request: Pick<SupplierServiceRequest, 'kind'>): boolean {
  return request.kind === 'Custom';
}

/**
 * A request on measure that is still in the negotiation: the supplier has to answer, or has sent an offer and waits. Once the customer accepts
 * it is a job like the others (taken, in progress, done) and the page is the usual one; a refused or lapsed one is over, and says so as any other.
 */
export function isOpenInquiry(request: Pick<SupplierServiceRequest, 'kind' | 'phase' | 'status'> & Partial<Pick<SupplierServiceRequest, 'backup'>>): boolean {
  if (!isInquiry(request)) return false;
  const phase = phaseOf(request);
  return phase === 'toAnswer' || phase === 'quotePending';
}

/** What the block "Adesso" says about the negotiation of an open request on measure. */
export type NegotiationView = 'awaiting' | 'conversation' | 'offerSent' | 'offerDeclined';

/** `negotiation` of the thread in the words of the console; a state this version does not know is read as the conversation going on. */
export function negotiationViewOf(negotiation: SupplierNegotiation | undefined): NegotiationView {
  switch (negotiation) {
    case 'AwaitingSupplier':
      return 'awaiting';
    case 'OfferSent':
      return 'offerSent';
    case 'OfferDeclined':
      return 'offerDeclined';
    default:
      return 'conversation';
  }
}

/**
 * The offer as the quote the summary of SP-04b knows how to show (decision SP-D30: one engine): the lines with their amounts (a line of
 * several says how many at what price), the total as the server added it up, the time, and until when the customer can answer. Nothing is
 * worked out here but the words of a line.
 */
export function offerAsQuote(offer: SupplierOffer, money: (cents: number) => string): ServiceRequestQuote {
  return {
    sentAt: offer.sentAt,
    lines: offer.lines.map((line) => ({
      label: line.quantity > 1 ? `${line.label} (${line.quantity} × ${money(line.unitAmountCents)})` : line.label,
      amountCents: line.amountCents,
    })),
    totalCents: offer.totalCents,
    note: offer.note ?? null,
    scheduledStart: offer.startUtc,
    scheduledEnd: offer.endUtc,
    answerBy: offer.validUntil ?? null,
  };
}

const TIME: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' };

/** Whole minutes from `now` to `due`, rounded up (a minute and a half left is two); 0 or less once it has passed. Null for a date that is not one. */
export function minutesLeft(due: string, now: number): number | null {
  const at = Date.parse(due);
  return Number.isFinite(at) ? Math.ceil((at - now) / 60_000) : null;
}

/**
 * "Rispondi entro le 14:30 · restano 42 minuti": the deadline the server gave, and how long is left of it, in the clock of Rome. Past the
 * deadline it says only that the time is over: what the server then does with the request is the server's to tell, and the page reads it
 * again; nothing is promised here (D24).
 */
export function respondByLine(due: string, now: number, locale: string, t: Translate): string | null {
  const left = minutesLeft(due, now);
  if (left === null) return null;
  if (left <= 0) return t('supplier.inquiry.now.timeOver');
  const time = formatRomeDateTime(due, locale, TIME);
  const by = romeDateOf(due) === todayInRome(new Date(now))
    ? t('supplier.requests.respondByToday', { time })
    : t('supplier.requests.respondByDay', { day: formatRomeDateTime(due, locale, { day: 'numeric', month: 'short' }), time });
  const remaining = left >= 120 ? t('supplier.inquiry.now.leftHours', { count: Math.floor(left / 60) }) : t('supplier.inquiry.now.leftMinutes', { count: left });
  return `${by} · ${remaining}`;
}
